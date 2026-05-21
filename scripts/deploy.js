import * as StellarSdk from 'stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const RPC_URL = 'https://soroban-testnet.stellar.org';
const FRIEND_BOT_URL = 'https://friendbot.stellar.org';

// In newer SDKs, SorobanRpc might be under .rpc or .SorobanRpc
const Server = StellarSdk.rpc ? StellarSdk.rpc.Server : StellarSdk.SorobanRpc.Server;
const server = new Server(RPC_URL);

async function fundAccount(publicKey) {
    return new Promise((resolve, reject) => {
        https.get(`${FRIEND_BOT_URL}?addr=${publicKey}`, (res) => {
            if (res.statusCode === 200) {
                resolve();
            } else {
                reject(new Error(`Friendbot failed with status: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

async function deploy() {
    console.log('🚀 Starting deployment script...');

    // 1. Generate and fund deployer
    const deployer = StellarSdk.Keypair.random();
    console.log(`🔑 Generated deployer: ${deployer.publicKey()}`);
    console.log('💰 Funding deployer...');
    await fundAccount(deployer.publicKey());

    // Wait for account to be created
    console.log('⏳ Waiting for account to be created...');
    let accountCreated = false;
    for (let i = 0; i < 20; i++) {
        try {
            await server.getAccount(deployer.publicKey());
            accountCreated = true;
            break;
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    if (!accountCreated) {
        throw new Error('Account funding failed or timed out');
    }
    console.log('✅ Deployer funded and verified');

    // 2. Define contracts
    const contracts = [
        {
            name: 'user_registry',
            path: '../contracts/user_registry/target/wasm32-unknown-unknown/release/user_registry.wasm'
        },
        {
            name: 'candidate_registry',
            path: '../contracts/candidate_registry/target/wasm32-unknown-unknown/release/candidate_registry.wasm'
        },
        {
            name: 'survey',
            path: '../contracts/survey/target/wasm32-unknown-unknown/release/survey.wasm'
        }
    ];

    const deployedContracts = {};

    for (const contractInfo of contracts) {
        console.log(`\n📦 Processing ${contractInfo.name}...`);
        const wasmPath = path.join(__dirname, contractInfo.path);
        const wasmBuffer = fs.readFileSync(wasmPath);

        // Load account
        let sourceAccount = await server.getAccount(deployer.publicKey());

        // Upload WASM
        console.log('  ⬆️ Uploading WASM...');
        const uploadTx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: "1000000",
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer }))
            .setTimeout(180)
            .build();

        console.log('  Tx XDR:', uploadTx.toXDR());
        uploadTx.sign(deployer);

        let sendResponse = await server.sendTransaction(uploadTx);
        if (sendResponse.status !== 'PENDING') {
            console.error('Upload failed:', sendResponse);
            if (sendResponse.errorResult) {
                console.error('Error XDR:', sendResponse.errorResult.toXDR('base64'));
            }
            throw new Error('Upload failed');
        }

        let statusResponse = await waitForTransaction(sendResponse.hash);
        if (statusResponse.status !== 'SUCCESS') {
            console.error('Upload transaction failed:', statusResponse);
            throw new Error('Upload transaction failed');
        }

        const wasmHash = statusResponse.returnValue.toBuffer().toString('hex');
        console.log(`  ✅ WASM Uploaded. Hash: ${wasmHash}`);

        // Deploy Contract (Create Instance)
        console.log('  ✨ Instantiating Contract...');
        sourceAccount = await server.getAccount(deployer.publicKey()); // Refresh sequence

        const deployTx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: "1000000",
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(StellarSdk.Operation.createContract({
                wasmHash: Buffer.from(wasmHash, 'hex')
            }))
            .setTimeout(180)
            .build();

        deployTx.sign(deployer);

        sendResponse = await server.sendTransaction(deployTx);
        if (sendResponse.status !== 'PENDING') {
            console.error('Deploy failed:', sendResponse);
            if (sendResponse.errorResult) {
                console.error('Error XDR:', sendResponse.errorResult.toXDR('base64'));
            }
            throw new Error('Deploy failed');
        }

        statusResponse = await waitForTransaction(sendResponse.hash);
        if (statusResponse.status !== 'SUCCESS') {
            console.error('Deploy transaction failed:', statusResponse);
            throw new Error('Deploy transaction failed');
        }

        const contractId = statusResponse.returnValue.address().toString();
        console.log(`  ✅ Contract Deployed. ID: ${contractId}`);

        deployedContracts[contractInfo.name] = contractId;
    }

    // 3. Initialize Survey Contract
    console.log('\n⚙️ Initializing Survey Contract...');
    const surveyId = deployedContracts['survey'];
    const surveyContract = new StellarSdk.Contract(surveyId);

    let sourceAccount = await server.getAccount(deployer.publicKey());

    const initTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "1000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(surveyContract.call('initialize', StellarSdk.nativeToScVal(deployer.publicKey(), { type: 'address' })))
        .setTimeout(180)
        .build();

    initTx.sign(deployer);

    // Simulation
    const simulated = await server.simulateTransaction(initTx);
    if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
        console.error('Initialize simulation failed:', simulated);
        throw new Error('Initialize simulation failed');
    }

    // Assemble
    const preparedInitTx = StellarSdk.rpc.assembleTransaction(initTx, simulated).build();
    preparedInitTx.sign(deployer);

    const sendResponse = await server.sendTransaction(preparedInitTx);
    const statusResponse = await waitForTransaction(sendResponse.hash);

    if (statusResponse.status === 'SUCCESS') {
        console.log('  ✅ Survey Contract Initialized');
    } else {
        console.error('  ❌ Survey Initialization Failed');
    }

    // 4. Save results
    const outputPath = path.join(__dirname, '../contracts/deploy-info.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        network: 'testnet',
        date: new Date().toISOString(),
        contracts: deployedContracts
    }, null, 2));

    console.log(`\n📄 Deployment info saved to ${outputPath}`);
}

async function waitForTransaction(hash) {
    let status;
    let response;
    const maxRetries = 60; // 60 seconds
    let retries = 0;

    while (retries < maxRetries) {
        response = await server.getTransaction(hash);
        status = response.status;

        if (status !== 'NOT_FOUND') {
            return response;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
    }
    throw new Error('Transaction timeout');
}

deploy().catch(console.error);

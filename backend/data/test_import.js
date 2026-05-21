async function test() {
  const sdk = await import('@stellar/stellar-sdk');
  console.log('sdk type:', typeof sdk);
  console.log('sdk has TransactionBuilder:', !!sdk.TransactionBuilder);
  console.log('sdk keys:', Object.keys(sdk).slice(0, 10));
  if (sdk.default) {
    console.log('sdk.default has TransactionBuilder:', !!sdk.default.TransactionBuilder);
  }
}
test();

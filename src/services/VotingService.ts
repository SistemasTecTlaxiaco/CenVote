// VotingService.ts - Servicio para gestionar el flujo completo de votación con XLM
import { freighterService } from './FreighterService';

export interface VotePayload {
    surveyId: string;
    candidateId: string;
    voterAddress: string;
}

export interface VoteResult {
    success: boolean;
    message: string;
    transactionHash?: string;
    error?: string;
}

// Dirección de destino para los pagos de votación (puede ser una cuenta del sistema)
// Por ahora usamos una cuenta genérica de testnet
const VOTE_PAYMENT_DESTINATION = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
const VOTE_FEE_XLM = '0.1'; // Costo de votar: 0.1 XLM
const SURVEY_CREATION_FEE_XLM = '5.0'; // Costo de crear encuesta: 5.0 XLM

class VotingService {
    /**
     * Ejecuta el flujo completo de votación:
     * 1. Verifica balance del votante
     * 2. Procesa pago de 0.1 XLM
     * 3. Registra el voto en MongoDB
     */
    async vote(payload: VotePayload): Promise<VoteResult> {
        try {
            console.log('🗳️ Iniciando proceso de votación...');

            // 1. Verificar que la wallet esté conectada
            let isConnected = freighterService.isConnected;

            // Si no aparece conectado pero tenemos public key, intentar verificar conexión
            if (!isConnected && freighterService.publicKey) {
                console.log('🔄 Intentando reconectar wallet...');
                isConnected = await freighterService.checkConnection();
            }

            if (!isConnected || !freighterService.publicKey) {
                return {
                    success: false,
                    message: 'Por favor conecta tu wallet primero',
                    error: 'Wallet not connected'
                };
            }

            // 2. Verificar balance
            console.log('💰 Verificando balance...');
            const balanceResult = await freighterService.getAccountBalance();

            if (!balanceResult) {
                return {
                    success: false,
                    message: 'No se pudo obtener el balance de tu cuenta',
                    error: 'Balance fetch failed'
                };
            }

            const balance = parseFloat(balanceResult.balance);
            const requiredAmount = parseFloat(VOTE_FEE_XLM);

            // Verificar que tenga suficiente balance (considerando 1 XLM de reserva mínima)
            if (balance < requiredAmount + 1) {
                return {
                    success: false,
                    message: `Balance insuficiente. Necesitas al menos ${requiredAmount + 1} XLM (${requiredAmount} XLM para votar + 1 XLM de reserva mínima). Balance actual: ${balance} XLM`,
                    error: 'Insufficient balance'
                };
            }

            console.log(`✅ Balance suficiente: ${balance} XLM`);

            // 3. Procesar pago de votación
            console.log(`💸 Procesando pago de ${VOTE_FEE_XLM} XLM...`);
            const paymentResult = await freighterService.sendPayment(
                VOTE_PAYMENT_DESTINATION,
                VOTE_FEE_XLM
            );

            if (!paymentResult.success) {
                return {
                    success: false,
                    message: `Error al procesar el pago: ${paymentResult.error}`,
                    error: paymentResult.error
                };
            }

            console.log('✅ Pago procesado:', paymentResult.transactionHash);

            // 4. Registrar voto en MongoDB
            console.log('📝 Registrando voto en la base de datos...');
            const API_URL = (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.PUBLIC_API_URL) || (typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.hostname + ':3000' : 'http://localhost:3000');
            const voteResponse = await fetch(`${API_URL}/api/surveys/${payload.surveyId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: payload.candidateId,
                    voterAddress: payload.voterAddress
                })
            });

            if (!voteResponse.ok) {
                const errorData = await voteResponse.json();
                // Si el voto en BD falló pero el pago se procesó, informar al usuario
                console.error('⚠️ Pago exitoso pero error al registrar voto:', errorData);
                return {
                    success: false,
                    message: `El pago se procesó exitosamente (${VOTE_FEE_XLM} XLM), pero hubo un error al registrar tu voto: ${errorData.error || 'Error desconocido'}. Por favor contacta al soporte con este hash de transacción: ${paymentResult.transactionHash}`,
                    error: errorData.error,
                    transactionHash: paymentResult.transactionHash
                };
            }

            const voteData = await voteResponse.json();

            console.log('✅ Voto registrado exitosamente!');

            return {
                success: true,
                message: `¡Voto registrado exitosamente! Consumiste ${VOTE_FEE_XLM} XLM`,
                transactionHash: paymentResult.transactionHash
            };

        } catch (error) {
            console.error('❌ Error en proceso de votación:', error);

            let errorMessage = 'Error inesperado en el proceso de votación';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: errorMessage,
                error: errorMessage
            };
        }
    }

    /**
     * Obtiene el costo de votar
     */
    getVoteFee(): string {
        return VOTE_FEE_XLM;
    }

    /**
     * Obtiene la dirección de destino de los pagos
     */
    getPaymentDestination(): string {
        return VOTE_PAYMENT_DESTINATION;
    }

    /**
     * Obtiene el costo de crear una encuesta
     */
    getSurveyCreationFee(): string {
        return SURVEY_CREATION_FEE_XLM;
    }

    /**
     * Ejecuta el cobro de creación de encuesta (5.0 XLM)
     */
    async paySurveyCreationFee(): Promise<VoteResult> {
        try {
            console.log('📊 Iniciando pago para la creación de la encuesta...');

            // 1. Verificar que la wallet esté conectada
            let isConnected = freighterService.isConnected;

            // Si no aparece conectado pero tenemos public key, intentar verificar conexión
            if (!isConnected && freighterService.publicKey) {
                console.log('🔄 Intentando reconectar wallet...');
                isConnected = await freighterService.checkConnection();
            }

            if (!isConnected || !freighterService.publicKey) {
                return {
                    success: false,
                    message: 'Por favor conecta tu wallet primero',
                    error: 'Wallet not connected'
                };
            }

            // 2. Verificar balance
            console.log('💰 Verificando balance...');
            const balanceResult = await freighterService.getAccountBalance();

            if (!balanceResult) {
                return {
                    success: false,
                    message: 'No se pudo obtener el balance de tu cuenta',
                    error: 'Balance fetch failed'
                };
            }

            const balance = parseFloat(balanceResult.balance);
            const requiredAmount = parseFloat(SURVEY_CREATION_FEE_XLM);

            // Verificar que tenga suficiente balance (considerando 1 XLM de reserva mínima)
            if (balance < requiredAmount + 1) {
                return {
                    success: false,
                    message: `Balance insuficiente. Necesitas al menos ${requiredAmount + 1} XLM (${requiredAmount} XLM para crear encuesta + 1 XLM de reserva mínima). Balance actual: ${balance} XLM`,
                    error: 'Insufficient balance'
                };
            }

            console.log(`✅ Balance suficiente: ${balance} XLM`);

            // 3. Procesar pago de creación
            console.log(`💸 Procesando pago de ${SURVEY_CREATION_FEE_XLM} XLM...`);
            const paymentResult = await freighterService.sendPayment(
                VOTE_PAYMENT_DESTINATION,
                SURVEY_CREATION_FEE_XLM
            );

            if (!paymentResult.success) {
                return {
                    success: false,
                    message: `Error al procesar el pago: ${paymentResult.error}`,
                    error: paymentResult.error
                };
            }

            console.log('✅ Pago de creación completado:', paymentResult.transactionHash);

            return {
                success: true,
                message: `¡Pago de creación de encuesta procesado exitosamente! Consumiste ${SURVEY_CREATION_FEE_XLM} XLM.`,
                transactionHash: paymentResult.transactionHash
            };

        } catch (error) {
            console.error('❌ Error en el pago de creación de encuesta:', error);

            let errorMessage = 'Error inesperado en el proceso de pago';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: errorMessage,
                error: errorMessage
            };
        }
    }
}

export const votingService = new VotingService();

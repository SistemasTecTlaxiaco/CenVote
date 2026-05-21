#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

// Estructura de datos para almacenar información del candidato
#[contracttype]
#[derive(Clone)]
pub struct Candidate {
    pub wallet: Address,
    pub name: String,
    pub rfc: String,
    pub timestamp: u64,
}

// Clave para el storage
#[contracttype]
pub enum DataKey {
    Candidate(Address), // Mapea wallet address -> Candidate
    CandidateList,      // Lista de todos los wallets de candidatos
    CandidateCount,     // Contador total de candidatos
}

#[contract]
pub struct CandidateRegistry;

#[contractimpl]
impl CandidateRegistry {
    /// Registra un nuevo candidato en la blockchain
    /// Retorna true si el registro fue exitoso
    pub fn register_candidate(
        env: Env,
        wallet: Address,
        name: String,
        rfc: String,
    ) -> bool {
        // Verificar que el wallet esté autenticado
        wallet.require_auth();

        // Verificar si el candidato ya existe
        let key = DataKey::Candidate(wallet.clone());
        if env.storage().persistent().has(&key) {
            return false; // Candidato ya registrado
        }

        // Crear registro de candidato
        let candidate = Candidate {
            wallet: wallet.clone(),
            name,
            rfc,
            timestamp: env.ledger().timestamp(),
        };

        // Guardar candidato en storage persistente
        env.storage().persistent().set(&key, &candidate);
        env.storage().persistent().extend_ttl(&key, 100, 8640000);

        // Agregar a la lista de candidatos
        let list_key = DataKey::CandidateList;
        let mut candidate_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        
        candidate_list.push_back(wallet);
        env.storage().persistent().set(&list_key, &candidate_list);
        env.storage().persistent().extend_ttl(&list_key, 100, 8640000);

        // Incrementar contador
        let count_key = DataKey::CandidateCount;
        let count: u64 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));
        env.storage().persistent().extend_ttl(&count_key, 100, 8640000);

        true
    }

    /// Obtiene los datos de un candidato por su wallet address
    pub fn get_candidate(env: Env, wallet: Address) -> Option<Candidate> {
        let key = DataKey::Candidate(wallet);
        env.storage().persistent().get(&key)
    }

    /// Verifica si un candidato está registrado
    pub fn candidate_exists(env: Env, wallet: Address) -> bool {
        let key = DataKey::Candidate(wallet);
        env.storage().persistent().has(&key)
    }

    /// Obtiene la lista de todos los wallets de candidatos registrados
    pub fn get_all_candidates(env: Env) -> Vec<Address> {
        let key = DataKey::CandidateList;
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    /// Obtiene el número total de candidatos registrados
    pub fn get_candidate_count(env: Env) -> u64 {
        let key = DataKey::CandidateCount;
        env.storage().persistent().get(&key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_register_candidate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CandidateRegistry);
        let client = CandidateRegistryClient::new(&env, &contract_id);

        let candidate_wallet = Address::generate(&env);

        // Registrar candidato
        let result = client.register_candidate(
            &candidate_wallet,
            &String::from_str(&env, "Juan Perez Lopez"),
            &String::from_str(&env, "PELJ850101ABC"),
        );

        assert!(result);
        assert!(client.candidate_exists(&candidate_wallet));
        assert_eq!(client.get_candidate_count(), 1);
    }

    #[test]
    fn test_get_candidate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CandidateRegistry);
        let client = CandidateRegistryClient::new(&env, &contract_id);

        let candidate_wallet = Address::generate(&env);

        // Registrar y obtener candidato
        client.register_candidate(
            &candidate_wallet,
            &String::from_str(&env, "Maria Garcia Rodriguez"),
            &String::from_str(&env, "GARM900202XYZ"),
        );

        let candidate = client.get_candidate(&candidate_wallet);
        assert!(candidate.is_some());

        let candidate_data = candidate.unwrap();
        assert_eq!(candidate_data.wallet, candidate_wallet);
    }

    #[test]
    fn test_get_all_candidates() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CandidateRegistry);
        let client = CandidateRegistryClient::new(&env, &contract_id);

        let candidate1 = Address::generate(&env);
        let candidate2 = Address::generate(&env);
        let candidate3 = Address::generate(&env);

        // Registrar varios candidatos
        client.register_candidate(
            &candidate1,
            &String::from_str(&env, "Candidato 1"),
            &String::from_str(&env, "RFC1"),
        );
        client.register_candidate(
            &candidate2,
            &String::from_str(&env, "Candidato 2"),
            &String::from_str(&env, "RFC2"),
        );
        client.register_candidate(
            &candidate3,
            &String::from_str(&env, "Candidato 3"),
            &String::from_str(&env, "RFC3"),
        );

        let all_candidates = client.get_all_candidates();
        assert_eq!(all_candidates.len(), 3);
        assert_eq!(client.get_candidate_count(), 3);
    }

    #[test]
    fn test_duplicate_registration() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CandidateRegistry);
        let client = CandidateRegistryClient::new(&env, &contract_id);

        let candidate_wallet = Address::generate(&env);

        // Primer registro exitoso
        let result1 = client.register_candidate(
            &candidate_wallet,
            &String::from_str(&env, "Carlos Sanchez"),
            &String::from_str(&env, "SACA950303DEF"),
        );
        assert!(result1);

        // Segundo registro debe fallar
        let result2 = client.register_candidate(
            &candidate_wallet,
            &String::from_str(&env, "Carlos Sanchez"),
            &String::from_str(&env, "SACA950303DEF"),
        );
        assert!(!result2);

        // Debe haber solo 1 candidato
        assert_eq!(client.get_candidate_count(), 1);
    }
}

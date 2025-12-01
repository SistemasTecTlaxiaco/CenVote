#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, Map, token};

// Estructura de datos para una encuesta
#[contracttype]
#[derive(Clone)]
pub struct Survey {
    pub survey_id: u64,
    pub creator: Address,
    pub name: String,
    pub description: String,
    pub start_date: u64,
    pub end_date: u64,
    pub candidates: Vec<Address>,
}

// Estructura para los resultados de votación
#[contracttype]
#[derive(Clone)]
pub struct VoteResult {
    pub candidate: Address,
    pub votes: u64,
}

// Claves de almacenamiento
#[contracttype]
pub enum DataKey {
    Survey(u64),                   // survey_id -> Survey
    Vote(u64, Address),            // (survey_id, voter) -> candidate voted for
    VoteCount(u64, Address),       // (survey_id, candidate) -> vote count
    VoterList(u64),                // survey_id -> Vec<Address> of voters
    SurveyCount,                   // Total number of surveys
    VoteFee,                       // Fee in stroops (1 XLM = 10^7 stroops) for voting
}

const VOTE_FEE_STROOPS: i128 = 1_000_000; // 0.1 XLM por voto

#[contract]
pub struct SurveyContract;

#[contractimpl]
impl SurveyContract {
    /// Inicializa el contrato con la dirección del administrador
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        
        let fee_key = DataKey::VoteFee;
        env.storage().instance().set(&fee_key, &VOTE_FEE_STROOPS);
        env.storage().instance().extend_ttl(100, 8640000);
        
        let count_key = DataKey::SurveyCount;
        env.storage().persistent().set(&count_key, &0u64);
        env.storage().persistent().extend_ttl(&count_key, 100, 8640000);
    }

    /// Crea una nueva encuesta
    pub fn create_survey(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        start_date: u64,
        end_date: u64,
        candidates: Vec<Address>,
    ) -> u64 {
        // Verificar autenticación del creador
        creator.require_auth();

        // Validaciones
        if candidates.len() == 0 {
            panic!("Survey must have at least one candidate");
        }
        if start_date >= end_date {
            panic!("Start date must be before end date");
        }

        // Obtener el siguiente ID de encuesta
        let count_key = DataKey::SurveyCount;
        let survey_id: u64 = env.storage().persistent().get(&count_key).unwrap_or(0) + 1;

        // Crear la encuesta
        let survey = Survey {
            survey_id,
            creator: creator.clone(),
            name,
            description,
            start_date,
            end_date,
            candidates: candidates.clone(),
        };

        // Guardar la encuesta
        let survey_key = DataKey::Survey(survey_id);
        env.storage().persistent().set(&survey_key, &survey);
        env.storage().persistent().extend_ttl(&survey_key, 100, 8640000);

        // Actualizar contador
        env.storage().persistent().set(&count_key, &survey_id);
        env.storage().persistent().extend_ttl(&count_key, 100, 8640000);

        // Inicializar lista de votantes
        let voters_key = DataKey::VoterList(survey_id);
        env.storage().persistent().set(&voters_key, &Vec::<Address>::new(&env));
        env.storage().persistent().extend_ttl(&voters_key, 100, 8640000);

        // Inicializar contadores de votos para cada candidato
        for candidate in candidates.iter() {
            let vote_count_key = DataKey::VoteCount(survey_id, candidate.clone());
            env.storage().persistent().set(&vote_count_key, &0u64);
            env.storage().persistent().extend_ttl(&vote_count_key, 100, 8640000);
        }

        survey_id
    }

    /// Registra un voto (requiere pago de fee en XLM)
    pub fn vote(
        env: Env,
        survey_id: u64,
        voter: Address,
        candidate: Address,
    ) -> bool {
        // Verificar autenticación del votante
        voter.require_auth();

        // Obtener la encuesta
        let survey_key = DataKey::Survey(survey_id);
        let survey: Survey = env.storage().persistent()
            .get(&survey_key)
            .expect("Survey not found");

        // Verificar que la encuesta esté activa
        let current_time = env.ledger().timestamp();
        if current_time < survey.start_date {
            panic!("Survey has not started yet");
        }
        if current_time > survey.end_date {
            panic!("Survey has ended");
        }

        // Verificar que el candidato esté en la lista
        let mut candidate_is_valid = false;
        for sc in survey.candidates.iter() {
            if sc == candidate {
                candidate_is_valid = true;
                break;
            }
        }
        if !candidate_is_valid {
            panic!("Candidate is not in this survey");
        }

        // Verificar que el votante no haya votado antes
        let vote_key = DataKey::Vote(survey_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic!("Voter has already voted in this survey");
        }

        // Registrar el voto
        env.storage().persistent().set(&vote_key, &candidate);
        env.storage().persistent().extend_ttl(&vote_key, 100, 8640000);

        // Incrementar contador de votos para el candidato
        let vote_count_key = DataKey::VoteCount(survey_id, candidate.clone());
        let current_count: u64 = env.storage().persistent()
            .get(&vote_count_key)
            .unwrap_or(0);
        env.storage().persistent().set(&vote_count_key, &(current_count + 1));
        env.storage().persistent().extend_ttl(&vote_count_key, 100, 8640000);

        // Agregar votante a la lista
        let voters_key = DataKey::VoterList(survey_id);
        let mut voters: Vec<Address> = env.storage().persistent()
            .get(&voters_key)
            .unwrap_or(Vec::new(&env));
        voters.push_back(voter);
        env.storage().persistent().set(&voters_key, &voters);
        env.storage().persistent().extend_ttl(&voters_key, 100, 8640000);

        true
    }

    /// Obtiene una encuesta por su ID
    pub fn get_survey(env: Env, survey_id: u64) -> Option<Survey> {
        let key = DataKey::Survey(survey_id);
        env.storage().persistent().get(&key)
    }

    /// Verifica si un votante ya votó en una encuesta
    pub fn has_voted(env: Env, survey_id: u64, voter: Address) -> bool {
        let key = DataKey::Vote(survey_id, voter);
        env.storage().persistent().has(&key)
    }

    /// Obtiene el candidato por el que votó un usuario (si ya votó)
    pub fn get_vote(env: Env, survey_id: u64, voter: Address) -> Option<Address> {
        let key = DataKey::Vote(survey_id, voter);
        env.storage().persistent().get(&key)
    }

    /// Obtiene los resultados de una encuesta
    pub fn get_results(env: Env, survey_id: u64) -> Vec<VoteResult> {
        let survey_key = DataKey::Survey(survey_id);
        let survey: Survey = env.storage().persistent()
            .get(&survey_key)
            .expect("Survey not found");

        let mut results = Vec::new(&env);

        for candidate in survey.candidates.iter() {
            let vote_count_key = DataKey::VoteCount(survey_id, candidate.clone());
            let votes: u64 = env.storage().persistent()
                .get(&vote_count_key)
                .unwrap_or(0);

            results.push_back(VoteResult {
                candidate: candidate.clone(),
                votes,
            });
        }

        results
    }

    /// Obtiene el total de votos en una encuesta
    pub fn get_total_votes(env: Env, survey_id: u64) -> u64 {
        let voters_key = DataKey::VoterList(survey_id);
        let voters: Vec<Address> = env.storage().persistent()
            .get(&voters_key)
            .unwrap_or(Vec::new(&env));
        voters.len() as u64
    }

    /// Obtiene el número total de encuestas
    pub fn get_survey_count(env: Env) -> u64 {
        let key = DataKey::SurveyCount;
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Obtiene el fee de votación en stroops
    pub fn get_vote_fee(env: Env) -> i128 {
        let key = DataKey::VoteFee;
        env.storage().instance().get(&key).unwrap_or(VOTE_FEE_STROOPS)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_create_survey() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SurveyContract);
        let client = SurveyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let candidate1 = Address::generate(&env);
        let candidate2 = Address::generate(&env);

        client.initialize(&admin);

        let mut candidates = Vec::new(&env);
        candidates.push_back(candidate1.clone());
        candidates.push_back(candidate2.clone());

        let survey_id = client.create_survey(
            &creator,
            &String::from_str(&env, "Test Survey"),
            &String::from_str(&env, "Description"),
            &1000,
            &2000,
            &candidates,
        );

        assert_eq!(survey_id, 1);
        assert_eq!(client.get_survey_count(), 1);

        let survey = client.get_survey(&survey_id);
        assert!(survey.is_some());
    }

    #[test]
    fn test_voting() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SurveyContract);
        let client = SurveyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        let candidate1 = Address::generate(&env);
        let candidate2 = Address::generate(&env);

        client.initialize(&admin);

        let mut candidates = Vec::new(&env);
        candidates.push_back(candidate1.clone());
        candidates.push_back(candidate2.clone());

        // Crear encuesta con fechas que incluyen el tiempo actual
        env.ledger().set_timestamp(1500);
        
        let survey_id = client.create_survey(
            &creator,
            &String::from_str(&env, "Voting Test"),
            &String::from_str(&env, "Test Description"),
            &1000,
            &3000,
            &candidates,
        );

        // Votar
        let vote_result = client.vote(&survey_id, &voter1, &candidate1);
        assert!(vote_result);

        // Verificar que votó
        assert!(client.has_voted(&survey_id, &voter1));

        // Votar con otro usuario
        client.vote(&survey_id, &voter2, &candidate2);

        // Verificar resultados
        let results = client.get_results(&survey_id);
        assert_eq!(results.len(), 2);
        assert_eq!(client.get_total_votes(&survey_id), 2);
    }

    #[test]
    #[should_panic(expected = "Voter has already voted")]
    fn test_double_voting() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SurveyContract);
        let client = SurveyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let voter = Address::generate(&env);
        let candidate1 = Address::generate(&env);
        let candidate2 = Address::generate(&env);

        client.initialize(&admin);

        let mut candidates = Vec::new(&env);
        candidates.push_back(candidate1.clone());
        candidates.push_back(candidate2.clone());

        env.ledger().set_timestamp(1500);

        let survey_id = client.create_survey(
            &creator,
            &String::from_str(&env, "Double Vote Test"),
            &String::from_str(&env, "Test"),
            &1000,
            &3000,
            &candidates,
        );

        // Primer voto
        client.vote(&survey_id, &voter, &candidate1);

        // Segundo voto (debe fallar)
        client.vote(&survey_id, &voter, &candidate2);
    }
}

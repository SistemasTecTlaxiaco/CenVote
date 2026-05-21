#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

// Estructura de datos para almacenar información del usuario
#[contracttype]
#[derive(Clone)]
pub struct User {
    pub wallet: Address,
    pub first_name: String,
    pub paternal_last_name: String,
    pub maternal_last_name: String,
    pub phone: String,
    pub email: String,
    pub timestamp: u64,
}

// Clave para el contador de usuarios
#[contracttype]
pub enum DataKey {
    User(Address), // Mapea wallet address -> User
    UserCount,     // Contador total de usuarios
}

#[contract]
pub struct UserRegistry;

#[contractimpl]
impl UserRegistry {
    /// Registra un nuevo usuario en la blockchain
    /// Retorna true si el registro fue exitoso
    pub fn register_user(
        env: Env,
        wallet: Address,
        first_name: String,
        paternal_last_name: String,
        maternal_last_name: String,
        phone: String,
        email: String,
    ) -> bool {
        // Verificar que el wallet esté autenticado
        wallet.require_auth();

        // Verificar si el usuario ya existe
        let key = DataKey::User(wallet.clone());
        if env.storage().persistent().has(&key) {
            return false; // Usuario ya registrado
        }

        // Crear registro de usuario
        let user = User {
            wallet: wallet.clone(),
            first_name,
            paternal_last_name,
            maternal_last_name,
            phone,
            email,
            timestamp: env.ledger().timestamp(),
        };

        // Guardar usuario en storage persistente
        env.storage().persistent().set(&key, &user);
        
        // Extender TTL del dato a 100 días (8,640,000 ledgers aprox)
        env.storage().persistent().extend_ttl(&key, 100, 8640000);

        // Incrementar contador de usuarios
        let count_key = DataKey::UserCount;
        let count: u64 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(count + 1));
        env.storage().persistent().extend_ttl(&count_key, 100, 8640000);

        true
    }

    /// Obtiene los datos de un usuario por su wallet address
    pub fn get_user(env: Env, wallet: Address) -> Option<User> {
        let key = DataKey::User(wallet);
        env.storage().persistent().get(&key)
    }

    /// Verifica si un usuario está registrado
    pub fn user_exists(env: Env, wallet: Address) -> bool {
        let key = DataKey::User(wallet);
        env.storage().persistent().has(&key)
    }

    /// Obtiene el número total de usuarios registrados
    pub fn get_user_count(env: Env) -> u64 {
        let key = DataKey::UserCount;
        env.storage().persistent().get(&key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_register_user() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let user_wallet = Address::generate(&env);

        // Registrar usuario
        let result = client.register_user(
            &user_wallet,
            &String::from_str(&env, "Juan"),
            &String::from_str(&env, "Perez"),
            &String::from_str(&env, "Lopez"),
            &String::from_str(&env, "1234567890"),
            &String::from_str(&env, "juan@example.com"),
        );

        assert!(result);
        assert!(client.user_exists(&user_wallet));
        assert_eq!(client.get_user_count(), 1);
    }

    #[test]
    fn test_get_user() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let user_wallet = Address::generate(&env);

        // Registrar y obtener usuario
        client.register_user(
            &user_wallet,
            &String::from_str(&env, "Maria"),
            &String::from_str(&env, "Garcia"),
            &String::from_str(&env, "Rodriguez"),
            &String::from_str(&env, "9876543210"),
            &String::from_str(&env, "maria@example.com"),
        );

        let user = client.get_user(&user_wallet);
        assert!(user.is_some());

        let user_data = user.unwrap();
        assert_eq!(user_data.wallet, user_wallet);
    }

    #[test]
    fn test_duplicate_registration() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UserRegistry);
        let client = UserRegistryClient::new(&env, &contract_id);

        let user_wallet = Address::generate(&env);

        // Primer registro exitoso
        let result1 = client.register_user(
            &user_wallet,
            &String::from_str(&env, "Carlos"),
            &String::from_str(&env, "Sanchez"),
            &String::from_str(&env, "Martinez"),
            &String::from_str(&env, "5555555555"),
            &String::from_str(&env, "carlos@example.com"),
        );
        assert!(result1);

        // Segundo registro debe fallar
        let result2 = client.register_user(
            &user_wallet,
            &String::from_str(&env, "Carlos"),
            &String::from_str(&env, "Sanchez"),
            &String::from_str(&env, "Martinez"),
            &String::from_str(&env, "5555555555"),
            &String::from_str(&env, "carlos@example.com"),
        );
        assert!(!result2);

        // Debe haber solo 1 usuario
        assert_eq!(client.get_user_count(), 1);
    }
}

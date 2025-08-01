use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use crate::commands::project_analysis::ProjectAnalysis;

#[derive(Clone)]
pub struct LanguageCache {
    cache: Arc<Mutex<HashMap<String, CachedAnalysis>>>,
    ttl: Duration,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedAnalysis {
    data: ProjectAnalysis,
    cached_at: u64,
}

impl LanguageCache {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    pub fn get(&self, key: &str) -> Option<ProjectAnalysis> {
        let cache = self.cache.lock().unwrap();
        
        if let Some(cached) = cache.get(key) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let age = Duration::from_secs(now - cached.cached_at);
            
            if age < self.ttl {
                log::debug!("Cache hit for key: {}", key);
                return Some(cached.data.clone());
            } else {
                log::debug!("Cache expired for key: {}", key);
            }
        }
        
        None
    }

    pub fn set(&self, key: String, data: ProjectAnalysis) {
        let mut cache = self.cache.lock().unwrap();
        
        let cached = CachedAnalysis {
            data,
            cached_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        
        log::debug!("Cached analysis for key: {}", &key);
        cache.insert(key, cached);
    }

    pub fn invalidate(&self, key: &str) {
        let mut cache = self.cache.lock().unwrap();
        cache.remove(key);
        log::debug!("Invalidated cache for key: {}", key);
    }

    pub fn clear(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
        log::debug!("Cleared all cache entries");
    }

    pub fn size(&self) -> usize {
        let cache = self.cache.lock().unwrap();
        cache.len()
    }
}

impl Default for LanguageCache {
    fn default() -> Self {
        Self::new(3600) // 1 hour default TTL
    }
}
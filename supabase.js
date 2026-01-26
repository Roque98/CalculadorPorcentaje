// Supabase Configuration
// IMPORTANT: Replace these values with your Supabase project credentials
const SUPABASE_URL = 'https://ncfxjvjhuheruariesbb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_U-K0h8acumoowssfoVA54A_We7p6avE';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== SETTINGS ====================

/**
 * Get user settings from Supabase
 * @returns {Promise<Object>} User settings object
 */
async function getSettings() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        return null;
    }

    return data;
}

/**
 * Save user settings to Supabase
 * @param {Object} settings - Settings object with x2_mode and account_names
 * @returns {Promise<Object>} Saved settings
 */
async function saveSettings(settings) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('user_settings')
        .upsert({
            user_id: user.id,
            x2_mode: settings.x2_mode,
            account_names: settings.account_names,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving settings:', error);
        return null;
    }

    return data;
}

// ==================== ACCOUNTS ====================

/**
 * Get all accounts data for the current user
 * @returns {Promise<Array>} Array of account objects
 */
async function getAccounts() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('account_number', { ascending: true });

    if (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }

    return data || [];
}

/**
 * Get a single account by account number
 * @param {number} accountNum - Account number (1, 2, or 3)
 * @returns {Promise<Object>} Account object
 */
async function getAccount(accountNum) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_number', accountNum)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching account:', error);
        return null;
    }

    return data;
}

/**
 * Save account data to Supabase
 * @param {number} accountNum - Account number (1, 2, or 3)
 * @param {Object} accountData - Account data object
 * @returns {Promise<Object>} Saved account data
 */
async function saveAccount(accountNum, accountData) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('accounts')
        .upsert({
            user_id: user.id,
            account_number: accountNum,
            usage_percent: accountData.usage_percent || 0,
            reset_date: accountData.reset_date || null,
            needs_update: accountData.needs_update || false,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,account_number'
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving account:', error);
        return null;
    }

    return data;
}

/**
 * Save all accounts data at once
 * @param {Object} accountsData - Object with account1, account2, account3 usage values
 * @returns {Promise<Array>} Array of saved accounts
 */
async function saveAllAccounts(accountsData) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const accounts = [1, 2, 3].map(num => ({
        user_id: user.id,
        account_number: num,
        usage_percent: parseFloat(accountsData[`account${num}`]) || 0,
        updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabaseClient
        .from('accounts')
        .upsert(accounts, {
            onConflict: 'user_id,account_number'
        })
        .select();

    if (error) {
        console.error('Error saving accounts:', error);
        return [];
    }

    return data;
}

// ==================== HISTORY ====================

/**
 * Get usage history for the current user
 * @param {number} limit - Maximum number of records to fetch (0 for all)
 * @returns {Promise<Array>} Array of history records
 */
async function getHistory(limit = 0) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    let query = supabaseClient
        .from('usage_history')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

    if (limit > 0) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching history:', error);
        return [];
    }

    return data || [];
}

/**
 * Save a history point to Supabase
 * @param {Object} historyData - History data with account1, account2, account3 values
 * @returns {Promise<Object>} Saved history record
 */
async function saveHistoryPoint(historyData) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('usage_history')
        .insert({
            user_id: user.id,
            timestamp: historyData.timestamp || new Date().toISOString(),
            account1: historyData.account1 || 0,
            account2: historyData.account2 || 0,
            account3: historyData.account3 || 0
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving history point:', error);
        return null;
    }

    return data;
}

/**
 * Clear all history for the current user
 * @returns {Promise<boolean>} Success status
 */
async function clearHistory() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    const { error } = await supabaseClient
        .from('usage_history')
        .delete()
        .eq('user_id', user.id);

    if (error) {
        console.error('Error clearing history:', error);
        return false;
    }

    return true;
}

// ==================== REALTIME ====================

/**
 * Subscribe to real-time changes on accounts table
 * @param {Function} callback - Callback function to handle changes
 * @returns {Object} Subscription channel
 */
function subscribeToAccountChanges(callback) {
    return supabaseClient
        .channel('accounts-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'accounts'
            },
            (payload) => {
                callback(payload);
            }
        )
        .subscribe();
}

/**
 * Subscribe to real-time changes on settings table
 * @param {Function} callback - Callback function to handle changes
 * @returns {Object} Subscription channel
 */
function subscribeToSettingsChanges(callback) {
    return supabaseClient
        .channel('settings-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'user_settings'
            },
            (payload) => {
                callback(payload);
            }
        )
        .subscribe();
}

/**
 * Subscribe to real-time changes on history table
 * @param {Function} callback - Callback function to handle changes
 * @returns {Object} Subscription channel
 */
function subscribeToHistoryChanges(callback) {
    return supabaseClient
        .channel('history-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'usage_history'
            },
            (payload) => {
                callback(payload);
            }
        )
        .subscribe();
}

/**
 * Unsubscribe from a channel
 * @param {Object} channel - Subscription channel to unsubscribe from
 */
function unsubscribeFromChannel(channel) {
    if (channel) {
        supabaseClient.removeChannel(channel);
    }
}

// ==================== USER PROFILE ====================

/**
 * Create or update user profile after signup
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<Object>} Profile data
 */
async function createUserProfile(userId, email) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            created_at: new Date().toISOString()
        }, {
            onConflict: 'id'
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating profile:', error);
        return null;
    }

    return data;
}

/**
 * Initialize default settings for new user
 * @returns {Promise<Object>} Settings data
 */
async function initializeUserData() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    // Create default settings
    const settings = await saveSettings({
        x2_mode: false,
        account_names: {
            account1: 'Cuenta 1',
            account2: 'Cuenta 2',
            account3: 'Cuenta 3'
        }
    });

    // Create default accounts
    for (let i = 1; i <= 3; i++) {
        await saveAccount(i, {
            usage_percent: 0,
            reset_date: null,
            needs_update: false
        });
    }

    return settings;
}

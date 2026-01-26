// Authentication Module for Claude Usage Monitor
// Requires supabase.js to be loaded first

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Result with user or error
 */
async function signIn(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user, session: data.session };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Result with user or error
 */
async function signUp(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // Create user profile and initialize data
        if (data.user) {
            await createUserProfile(data.user.id, data.user.email);
            await initializeUserData();
        }

        return {
            success: true,
            user: data.user,
            session: data.session,
            emailConfirmationRequired: !data.session
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Sign out the current user
 * @returns {Promise<Object>} Result with success status
 */
async function signOut() {
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get the current authenticated user
 * @returns {Promise<Object|null>} User object or null
 */
async function getCurrentUser() {
    try {
        // First check if there's a session
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            return null;
        }

        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error) {
            // Don't log "Auth session missing" as error - it's expected when not logged in
            if (!error.message?.includes('session')) {
                console.error('Error getting user:', error);
            }
            return null;
        }

        return user;
    } catch (err) {
        // Don't log session missing errors
        if (!err.message?.includes('session')) {
            console.error('Error getting user:', err);
        }
        return null;
    }
}

/**
 * Get the current session
 * @returns {Promise<Object|null>} Session object or null
 */
async function getSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Error getting session:', error);
            return null;
        }

        return session;
    } catch (err) {
        console.error('Error getting session:', err);
        return null;
    }
}

/**
 * Listen for authentication state changes
 * @param {Function} callback - Callback function that receives (event, session)
 * @returns {Object} Subscription object with unsubscribe method
 */
function onAuthStateChange(callback) {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });

    return subscription;
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if authenticated
 */
async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
}

/**
 * Redirect to login if not authenticated
 * @param {string} loginUrl - URL to redirect to (default: 'login.html')
 * @returns {Promise<boolean>} True if authenticated, false if redirected
 */
async function requireAuth(loginUrl = 'login.html') {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
        window.location.href = loginUrl;
        return false;
    }

    return true;
}

/**
 * Redirect to main page if already authenticated
 * @param {string} mainUrl - URL to redirect to (default: 'index.html')
 * @returns {Promise<boolean>} True if not authenticated, false if redirected
 */
async function redirectIfAuthenticated(mainUrl = 'index.html') {
    const authenticated = await isAuthenticated();

    if (authenticated) {
        window.location.href = mainUrl;
        return false;
    }

    return true;
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<Object>} Result with success status
 */
async function resetPassword(email) {
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Result with success status
 */
async function updatePassword(newPassword) {
    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

        let token = '';
        let token2 = '';
        let listId = '';
        let myListId = '';
        let currentUserId = '';
        let currentLists = [];
        let currentItems = [];
        let currentNotifications = [];
        let currentMyListItems = [];
        let currentMembers = [];
        let dismissedBudgetAlertListIds = [];
        let createListDrawerHideTimeout = null;
        let editingMyListItemId = null;
        let editingMyListDetails = false;
        let showingMyListQuickAddForm = false;
        let authMode = 'login';
        const INITIAL_PAGE = window.__INITIAL_PAGE__ || 'dashboard';
        let activeWorkspaceSection = INITIAL_PAGE;

        const BASE_URL = 'http://localhost:8000';
        const SESSION_STORAGE_KEY = 'basketwise.session';
        const DISMISSED_BUDGET_ALERTS_STORAGE_KEY = 'basketwise.dismissedBudgetAlerts';

        function getStoredSession() {
            try {
                const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
                return rawSession ? JSON.parse(rawSession) : null;
            } catch {
                return null;
            }
        }

        function saveSession(email) {
            if (!token || !currentUserId || !email) {
                return;
            }

            try {
                window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                    token,
                    currentUserId,
                    email,
                    activeWorkspaceSection,
                }));
            } catch {
                // Ignore browser storage failures and continue with in-memory auth.
            }
        }

        function clearStoredSession() {
            try {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
            } catch {
                // Ignore browser storage failures during logout/session expiry.
            }
        }

        function loadDismissedBudgetAlertListIds() {
            if (!currentUserId) {
                dismissedBudgetAlertListIds = [];
                return;
            }

            try {
                const rawValue = window.localStorage.getItem(DISMISSED_BUDGET_ALERTS_STORAGE_KEY);
                const storedMap = rawValue ? JSON.parse(rawValue) : {};
                const storedIds = storedMap[currentUserId];
                dismissedBudgetAlertListIds = Array.isArray(storedIds) ? storedIds : [];
            } catch {
                dismissedBudgetAlertListIds = [];
            }
        }

        function saveDismissedBudgetAlertListIds() {
            if (!currentUserId) {
                return;
            }

            try {
                const rawValue = window.localStorage.getItem(DISMISSED_BUDGET_ALERTS_STORAGE_KEY);
                const storedMap = rawValue ? JSON.parse(rawValue) : {};
                storedMap[currentUserId] = dismissedBudgetAlertListIds;
                window.localStorage.setItem(DISMISSED_BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(storedMap));
            } catch {
                // Ignore browser storage failures and continue with in-memory state.
            }
        }

        function resetRuntimeState() {
            token = '';
            token2 = '';
            listId = '';
            myListId = '';
            currentUserId = '';
            currentLists = [];
            currentItems = [];
            currentMyListItems = [];
            currentMembers = [];
            currentNotifications = [];
            dismissedBudgetAlertListIds = [];
            editingMyListItemId = null;
            editingMyListDetails = false;
            showingMyListQuickAddForm = false;
            activeWorkspaceSection = INITIAL_PAGE;
        }

        function isAuthError(error) {
            return Boolean(error && typeof error.message === 'string' && (
                error.message.includes('HTTP 401') || error.message.includes('HTTP 403')
            ));
        }

        function endUserSession(message = 'Gata pentru testare') {
            clearStoredSession();
            resetRuntimeState();

            document.getElementById('workspace').classList.remove('active');
            document.getElementById('auth-view').classList.remove('hidden');
            document.getElementById('current-user-display').textContent = 'Niciun utilizator activ';
            document.getElementById('profile-display-name').textContent = 'Guest User';
            document.getElementById('profile-display-email').textContent = 'not-logged-in@example.com';
            document.getElementById('profile-avatar').textContent = 'BW';
            setAuthMode('login');
            window.history.replaceState({}, '', '/');
            updateStatus(message);
        }

        function getSectionPath(section) {
            if (section === 'shared') {
                section = 'my-lists';
            }

            const sectionMap = {
                dashboard: '/dashboard',
                'my-lists': '/my-lists',
                notifications: '/notifications',
                'control-center': '/control-center',
            };

            return sectionMap[section] || '/dashboard';
        }

        function getInputValue(id) {
            return document.getElementById(id).value.trim();
        }

        function getUser1Credentials() {
            return {
                email: getInputValue('user1-email'),
                password: getInputValue('user1-password'),
            };
        }

        function getUser2Credentials() {
            return {
                email: getInputValue('user2-email'),
                password: getInputValue('user2-password'),
            };
        }

        function getLoginUser1Credentials() {
            return {
                email: getInputValue('login-user1-email'),
                password: getInputValue('login-user1-password'),
            };
        }

        function getCreateListFieldIds(source = 'drawer') {
            if (source !== 'control-center') {
                return {
                    name: 'drawer-list-name',
                    budget: 'drawer-list-budget',
                };
            }

            return {
                name: 'list-name',
                budget: 'list-budget',
            };
        }

        function getCreateListPayload(source = 'drawer') {
            const fieldIds = getCreateListFieldIds(source);
            return {
                name: getInputValue(fieldIds.name),
                max_budget: Number(getInputValue(fieldIds.budget)),
            };
        }

        function getCreateItemPayload() {
            return {
                name: getInputValue('item-name'),
                quantity: Number(getInputValue('item-quantity')),
                estimated_price: Number(getInputValue('item-price')),
            };
        }

        function validateCredentials(credentials, label) {
            if (!credentials.email || !credentials.password) {
                throw new Error(`Completează emailul și parola pentru ${label}.`);
            }
        }

        function togglePassword(inputId, button) {
            const input = document.getElementById(inputId);
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            button.textContent = isPassword ? 'Ascunde' : 'Arată';
        }

        function setAuthMode(mode) {
            authMode = mode;

            const loginTab = document.getElementById('login-tab');
            const registerTab = document.getElementById('register-tab');
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const registerResponse = document.getElementById('register-response');
            const title = document.getElementById('auth-title');
            const subtitle = document.getElementById('auth-subtitle');
            const metaCopy = document.getElementById('auth-meta-copy');
            const metaButton = document.getElementById('auth-meta-button');

            const isLogin = mode === 'login';

            loginTab.classList.toggle('active', isLogin);
            registerTab.classList.toggle('active', !isLogin);
            loginForm.classList.toggle('hidden', !isLogin);
            registerForm.classList.toggle('hidden', isLogin);
            if (registerResponse) {
                registerResponse.classList.add('hidden');
                registerResponse.classList.remove('success', 'error');
                registerResponse.textContent = '';
            }

            title.textContent = isLogin ? 'Bun venit înapoi' : 'Creează cont nou';
            subtitle.textContent = isLogin
                ? 'Introdu datele tale pentru a accesa listele și fluxurile de colaborare.'
                : 'Înregistrează un utilizator nou și pornește rapid testarea fluxurilor reale.';
            metaCopy.textContent = isLogin
                ? 'Nu ai cont? Treci pe înregistrare și creează unul în câteva secunde.'
                : 'Ai deja cont? Revino în modul de autentificare.';
            metaButton.textContent = isLogin ? 'Înregistrează-te' : 'Autentifică-te';
            metaButton.onclick = () => setAuthMode(isLogin ? 'register' : 'login');
        }

        function submitLogin(event) {
            event.preventDefault();
            loginUser1();
        }

        function submitRegister(event) {
            event.preventDefault();
            registerUser();
        }

        function showWorkspaceForUser(email, preferredSection = INITIAL_PAGE) {
            const displayName = formatDisplayName(email);
            loadDismissedBudgetAlertListIds();
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('workspace').classList.add('active');
            document.getElementById('current-user-display').textContent = email;
            document.getElementById('dashboard-greeting').textContent = `Bună, ${displayName}`;
            document.getElementById('profile-display-name').textContent = displayName;
            document.getElementById('profile-display-email').textContent = email;
            document.getElementById('profile-avatar').textContent = displayName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join('');
            setWorkspaceSection(preferredSection || INITIAL_PAGE);
            saveSession(email);
        }

        function logoutUser() {
            endUserSession('Gata pentru testare');
        }

        function setWorkspaceSection(section) {
            if (section === 'shared') {
                section = 'my-lists';
            }

            if (section === 'control-center') {
                section = 'dashboard';
            }

            activeWorkspaceSection = section;
            closeCreateListDrawer();
            document.getElementById('dashboard-section').classList.toggle('active', section === 'dashboard');
            document.getElementById('my-lists-section').classList.toggle('active', section === 'my-lists');
            document.getElementById('notifications-section').classList.toggle('active', section === 'notifications');
            document.getElementById('nav-dashboard').classList.toggle('active', section === 'dashboard');
            document.getElementById('nav-my-lists').classList.toggle('active', section === 'my-lists');
            document.getElementById('nav-notifications').classList.toggle('active', section === 'notifications');
            window.history.replaceState({}, '', getSectionPath(section));

            const currentUserEmail = document.getElementById('current-user-display').textContent;
            if (token && currentUserEmail && currentUserEmail !== 'Niciun utilizator activ') {
                saveSession(currentUserEmail);
            }
        }

        function clearCreateListResponse(source = 'drawer') {
            const responseId = source === 'drawer' ? 'create-list-drawer-response' : 'lists-response';
            const responseElement = document.getElementById(responseId);
            if (!responseElement) {
                return;
            }

            responseElement.classList.add('hidden');
            responseElement.classList.remove('success', 'error');
            responseElement.textContent = '';
        }

        function resetCreateListForm(source = 'drawer') {
            const fieldIds = getCreateListFieldIds(source);
            const nameInput = document.getElementById(fieldIds.name);
            const budgetInput = document.getElementById(fieldIds.budget);

            if (nameInput) {
                nameInput.value = '';
            }

            if (budgetInput) {
                budgetInput.value = '500';
            }

            clearCreateListResponse(source);
        }

        function openCreateListDrawer() {
            const drawer = document.getElementById('create-list-drawer');
            if (!drawer) {
                return;
            }

            if (createListDrawerHideTimeout) {
                window.clearTimeout(createListDrawerHideTimeout);
                createListDrawerHideTimeout = null;
            }
            drawer.classList.remove('hidden');
            drawer.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(() => {
                drawer.classList.add('active');
            });
            clearCreateListResponse('drawer');

            const nameInput = document.getElementById('drawer-list-name');
            if (nameInput) {
                nameInput.focus();
            }
        }

        function closeCreateListDrawer() {
            const drawer = document.getElementById('create-list-drawer');
            if (!drawer || drawer.classList.contains('hidden')) {
                return;
            }

            drawer.classList.remove('active');
            drawer.setAttribute('aria-hidden', 'true');
            createListDrawerHideTimeout = window.setTimeout(() => {
                drawer.classList.add('hidden');
                createListDrawerHideTimeout = null;
            }, 220);
            resetCreateListForm('drawer');
        }

        function formatCurrency(value) {
            const numeric = Number(value);
            if (Number.isNaN(numeric)) {
                return '0 RON';
            }

            return `${numeric.toFixed(2)} RON`;
        }

        function toNumber(value) {
            const numeric = Number(value);
            return Number.isNaN(numeric) ? 0 : numeric;
        }

        function getBudgetStatusLabel(status) {
            const labels = {
                within_budget: 'În limită',
                near_limit: 'Aproape de limită',
                over_budget: 'Depășit',
            };
            return labels[status] || status || 'Necunoscut';
        }

        function getBudgetSnapshotMeta(snapshot, fallbackMaxBudget = 0) {
            const maxBudget = toNumber(snapshot?.max_budget ?? fallbackMaxBudget);
            const currentTotal = toNumber(snapshot?.current_total);
            const remainingBudget = snapshot?.remaining_budget !== undefined
                ? toNumber(snapshot.remaining_budget)
                : maxBudget - currentTotal;
            const status = snapshot?.status || (
                maxBudget <= 0
                    ? (currentTotal > 0 ? 'over_budget' : 'within_budget')
                    : (currentTotal > maxBudget ? 'over_budget' : 'within_budget')
            );
            const progress = maxBudget > 0 ? Math.min((currentTotal / maxBudget) * 100, 100) : 0;

            return {
                maxBudget,
                currentTotal,
                remainingBudget,
                status,
                progress,
                statusLabel: getBudgetStatusLabel(status),
                isOverBudget: remainingBudget < 0,
                trackClass: status === 'over_budget' ? 'over-budget' : '',
            };
        }

        function getDashboardSearchTerm() {
            return getInputValue('dashboard-search').toLowerCase();
        }

        function formatDisplayName(email) {
            const localPart = (email || '').split('@')[0] || 'Utilizator';
            return localPart
                .split(/[._-]+/)
                .filter(Boolean)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        }

        function focusCreateListForm() {
            openCreateListDrawer();
        }

        function submitCreateListDrawer(event) {
            event.preventDefault();
            createList('drawer');
        }

        async function markAllNotificationsRead() {
            if (!token) {
                return;
            }

            const unreadNotifications = Array.isArray(currentNotifications)
                ? currentNotifications.filter((notification) => !notification.read)
                : [];

            if (unreadNotifications.length === 0) {
                dismissedBudgetAlertListIds = getOverBudgetAlertListIds(currentLists);
                saveDismissedBudgetAlertListIds();
                renderDashboard(currentLists, currentNotifications);
                renderNotificationsFeed(currentNotifications, currentLists);
                return;
            }

            try {
                await Promise.all(
                    unreadNotifications.map((notification) =>
                        makeRequest('PATCH', `/notifications/${notification.id}`, null, token)
                    )
                );

                currentNotifications = currentNotifications.map((notification) => ({
                    ...notification,
                    read: true,
                }));
                dismissedBudgetAlertListIds = getOverBudgetAlertListIds(currentLists);
                saveDismissedBudgetAlertListIds();
                renderDashboard(currentLists, currentNotifications);
                renderNotificationsFeed(currentNotifications, currentLists);
                await refreshDashboard();
            } catch (error) {
                console.error('Eroare la marcarea tuturor notificărilor ca citite:', error);
            }
        }

        function toggleAddItemForm() {
            const form = document.getElementById('add-item-form');
            const shouldShow = form.classList.contains('hidden');
            form.classList.toggle('hidden');

            if (shouldShow) {
                document.getElementById('item-name').focus();
            }
        }

        function submitAddItemForm(event) {
            event.preventDefault();
            addItem();
        }

        function toggleUpdateListForm() {
            const form = document.getElementById('update-list-form');
            const shouldShow = form.classList.contains('hidden');
            form.classList.toggle('hidden');

            if (shouldShow) {
                document.getElementById('update-list-name').focus();
            }
        }

        function submitUpdateListForm(event) {
            event.preventDefault();
            updateList();
        }

        function toggleUpdateItemForm() {
            const form = document.getElementById('update-item-form');
            const shouldShow = form.classList.contains('hidden');
            form.classList.toggle('hidden');

            if (shouldShow) {
                document.getElementById('update-item-name').focus();
            }
        }

        function submitUpdateItemForm(event) {
            event.preventDefault();
            updateItem();
        }

        function updateStatus(message) {
            document.getElementById('global-status').textContent = 'Status: ' + message;
        }

        function formatAccessibleLists(lists) {
            if (!Array.isArray(lists) || lists.length === 0) {
                return {
                    created_by_me: [],
                    shared_with_me: [],
                };
            }

            return {
                created_by_me: lists.filter((list) => list.owner_id === currentUserId),
                shared_with_me: lists.filter((list) => list.owner_id !== currentUserId),
            };
        }

        function showResponse(elementId, response, isSuccess = true) {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`showResponse: elementul #${elementId} nu există în pagina curentă.`);
                return;
            }

            element.classList.remove('hidden', 'success', 'error');
            element.classList.add('response', isSuccess ? 'success' : 'error');
            element.textContent = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        }

        function populateItemSelect(items) {
            const select = document.getElementById('item-select');
            select.innerHTML = '';

            if (!Array.isArray(items) || items.length === 0) {
                select.classList.add('hidden');
                return;
            }

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Alege un articol...';
            select.appendChild(placeholder);

            for (const item of items) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (cantitate: ${item.quantity}, preț: ${item.estimated_price})`;
                select.appendChild(option);
            }

            select.classList.remove('hidden');
        }

        function getSelectedItemId() {
            return document.getElementById('item-select').value;
        }

        async function makeRequest(method, url, data = null, authToken = null) {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const config = {
                method: method,
                headers: headers
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            const response = await fetch(BASE_URL + url, config);
            const result = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${result}`);
            }

            try {
                return JSON.parse(result);
            } catch {
                return result;
            }
        }

        async function initializeApp() {
            setAuthMode('login');
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeCreateListDrawer();
                }
            });

            const storedSession = getStoredSession();
            if (!storedSession || !storedSession.token || !storedSession.currentUserId || !storedSession.email) {
                updateStatus('Gata pentru testare');
                return;
            }

            token = storedSession.token;
            currentUserId = storedSession.currentUserId;
            showWorkspaceForUser(storedSession.email, INITIAL_PAGE);
            updateStatus('Se restaurează sesiunea...');

            try {
                await refreshDashboard();
            } catch (error) {
                if (isAuthError(error)) {
                    endUserSession('Sesiunea a expirat. Autentifică-te din nou.');
                    return;
                }

                updateStatus('Sesiune restaurată parțial');
            }
        }

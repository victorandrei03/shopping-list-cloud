        function filterListsForDashboard(lists) {
            const search = getDashboardSearchTerm();
            if (!search) {
                return lists;
            }

            return lists.filter((list) => (list.name || '').toLowerCase().includes(search));
        }

        async function enrichAccessibleLists(lists) {
            if (!Array.isArray(lists) || lists.length === 0) {
                return [];
            }

            return Promise.all(lists.map(async (list) => {
                try {
                    const members = await makeRequest('GET', `/lists/${list.id}/members`, null, token);
                    const safeMembers = Array.isArray(members) ? members : [];
                    const owner = safeMembers.find((member) => member.role === 'owner');
                    const currentMember = safeMembers.find((member) => member.user_id === currentUserId);
                    const participantEmails = safeMembers
                        .map((member) => member.email || '')
                        .filter(Boolean);

                    return {
                        ...list,
                        access_role: list.owner_id === currentUserId ? 'owner' : (currentMember?.role || 'viewer'),
                        owner_email: owner?.email || '',
                        participant_emails: participantEmails,
                    };
                } catch {
                    return {
                        ...list,
                        access_role: list.owner_id === currentUserId ? 'owner' : 'viewer',
                        participant_emails: [],
                    };
                }
            }));
        }

        function getDashboardInitials(email) {
            const displayName = formatDisplayName(email || '');
            const initials = displayName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join('');

            return initials || 'BW';
        }

        function buildDashboardParticipants(list) {
            const participantEmails = Array.isArray(list.participant_emails) ? list.participant_emails : [];
            const visibleParticipants = participantEmails.slice(0, 3);
            const extraCount = Math.max(participantEmails.length - visibleParticipants.length, 0);

            if (!visibleParticipants.length) {
                const fallbackEmail = list.owner_email || '';
                return `
                    <div class="avatar-stack" aria-label="Participanți indisponibili">
                        <span class="avatar-chip">${getDashboardInitials(fallbackEmail)}</span>
                    </div>
                `;
            }

            return `
                <div class="avatar-stack" aria-label="Participanți listă">
                    ${visibleParticipants.map((email) => `<span class="avatar-chip">${getDashboardInitials(email)}</span>`).join('')}
                    ${extraCount > 0 ? `<span class="avatar-chip">+${extraCount}</span>` : ''}
                </div>
            `;
        }

        function buildListCard(list, type) {
            const itemsCount = Array.isArray(list.items) ? list.items.length : 0;
            const budgetMeta = getBudgetSnapshotMeta(list.budget_snapshot, list.max_budget);
            const progressLabel = budgetMeta.maxBudget > 0
                ? `${Math.round(budgetMeta.progress)}% din buget consumat`
                : 'Fără limită de buget setată';
            const productsLabel = `${itemsCount} ${itemsCount === 1 ? 'produs' : 'produse'}`;
            const badgeClass = type === 'owner' ? 'badge-owner' : 'badge-shared';
            const sharedRole = list.access_role === 'editor' ? 'EDITOR' : 'VIEWER';
            const badgeText = type === 'owner' ? 'OWNER' : sharedRole;
            const budgetStateClass = budgetMeta.trackClass;
            const metaLine = type === 'owner'
                ? `${productsLabel} • ${list.created_at ? `Actualizat ${new Date(list.created_at).toLocaleDateString('ro-RO')}` : 'Actualizat recent'}`
                : `${productsLabel} • Partajată în sesiunea curentă`;
            const peopleMarkup = buildDashboardParticipants(list);

            return `
                <article class="list-dashboard-card">
                    <div class="list-dashboard-card-header">
                        <div>
                            <span class="badge ${badgeClass}">${badgeText}</span>
                            <h4>${list.name || 'Listă fără nume'}</h4>
                            <div class="list-dashboard-meta">
                                ${metaLine}
                            </div>
                        </div>
                        ${peopleMarkup}
                    </div>
                    <div>
                        <span class="budget-caption">Buget</span>
                        <div class="budget-row">
                            <span class="dashboard-subtle"></span>
                            <strong class="${budgetStateClass}">${formatCurrency(budgetMeta.currentTotal)} / ${formatCurrency(budgetMeta.maxBudget)}</strong>
                        </div>
                        <div class="budget-track">
                            <span class="${budgetStateClass}" style="width:${budgetMeta.progress}%"></span>
                        </div>
                    </div>
                    <div class="budget-row">
                        <span class="dashboard-subtle budget-percentage">${progressLabel}</span>
                        <button type="button" class="view-all-button" onclick="openListFromDashboard('${list.id}')">Deschide</button>
                    </div>
                </article>
            `;
        }

        function renderListCollection(elementId, lists, type, emptyMessage) {
            const container = document.getElementById(elementId);
            const filteredLists = filterListsForDashboard(lists);

            if (!Array.isArray(filteredLists) || filteredLists.length === 0) {
                container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
                return;
            }

            container.innerHTML = filteredLists.map((list) => buildListCard(list, type)).join('');
        }

        function renderRecentActivity(notifications, ownedLists, sharedLists) {
            const container = document.getElementById('recent-activity');
            const cards = [];
            const unreadNotifications = Array.isArray(notifications)
                ? notifications.filter((notification) => !notification.read)
                : [];

            if (unreadNotifications.length > 0) {
                for (const notification of unreadNotifications.slice(0, 4)) {
                    cards.push(`
                        <article class="notification-card">
                            <div class="notification-icon primary">🛒</div>
                            <div class="notification-body">
                                <strong>Actualizare listă</strong>
                                <span>${notification.message || 'Mesaj indisponibil'}</span>
                            </div>
                        </article>
                    `);
                }
            }

            const overBudgetLists = [...ownedLists, ...sharedLists].filter((list) => {
                const budgetMeta = getBudgetSnapshotMeta(list.budget_snapshot, list.max_budget);
                return budgetMeta.status === 'over_budget' && !dismissedBudgetAlertListIds.includes(list.id);
            });

            for (const list of overBudgetLists.slice(0, 2)) {
                cards.push(`
                    <article class="notification-card">
                        <div class="notification-icon error">!</div>
                        <div class="notification-body">
                            <strong>Buget depășit!</strong>
                            <span>Lista "${list.name}" a depășit bugetul setat și are nevoie de ajustări.</span>
                        </div>
                    </article>
                `);
            }

            if (cards.length === 0) {
                container.innerHTML = '<div class="empty-state">Nu sunt notificări încă.</div>';
                return;
            }

            container.innerHTML = cards.join('');
        }

        function renderNotificationsFeed(notifications, lists) {
            const container = document.getElementById('notifications-feed');
            const cards = [];
            const formatted = formatAccessibleLists(lists);
            const allLists = [...formatted.created_by_me, ...formatted.shared_with_me];
            const unreadNotifications = Array.isArray(notifications)
                ? notifications.filter((notification) => !notification.read)
                : [];

            if (unreadNotifications.length > 0) {
                for (const notification of unreadNotifications.slice(0, 4)) {
                    cards.push(`
                        <article class="notification-feed-card" data-notification-id="${notification.id}">
                            <div class="notification-feed-icon primary">👥</div>
                            <div class="notification-feed-body">
                                <div class="notification-feed-top">
                                    <strong>Actualizare colaborare</strong>
                                    <div class="notification-feed-actions">
                                        <span class="notification-time">RECENT</span>
                                        <button
                                            type="button"
                                            class="notification-dismiss-button"
                                            data-dismiss-notification-id="${notification.id}"
                                            aria-label="Marchează notificarea ca citită"
                                        >✕</button>
                                    </div>
                                </div>
                                <p>${notification.message || 'Mesaj indisponibil'}</p>
                            </div>
                        </article>
                    `);
                }
            }

            for (const list of allLists.slice(0, 3)) {
                const budgetMeta = getBudgetSnapshotMeta(list.budget_snapshot, list.max_budget);

                if (budgetMeta.status === 'over_budget' && !dismissedBudgetAlertListIds.includes(list.id)) {
                    const progress = budgetMeta.maxBudget > 0
                        ? Math.round((budgetMeta.currentTotal / budgetMeta.maxBudget) * 100)
                        : 100;
                    cards.push(`
                        <article class="notification-feed-card error">
                            <div class="notification-feed-icon error">!</div>
                            <div class="notification-feed-body">
                                <div class="notification-feed-top">
                                    <strong>Alertă Buget Depășit</strong>
                                    <span class="notification-time">ALERTĂ</span>
                                </div>
                                <p>Lista <strong>"${list.name}"</strong> a depășit bugetul setat cu <strong>${formatCurrency(Math.abs(budgetMeta.remainingBudget))}</strong>.</p>
                                <div class="notification-progress">
                                    <div class="notification-progress-meta">
                                        <span>PROGRES BUGET</span>
                                        <span class="error">${progress}%</span>
                                    </div>
                                    <div class="budget-track">
                                        <span class="over-budget" style="width:100%"></span>
                                    </div>
                                </div>
                            </div>
                        </article>
                    `);
                }
            }

            if (cards.length === 0) {
                container.innerHTML = '<div class="empty-state">Nu mai sunt alte notificări de afișat.</div>';
                return;
            }

            container.innerHTML = cards.join('');

            container.onclick = async (e) => {
                const dismissButton = e.target.closest('[data-dismiss-notification-id]');
                if (dismissButton) {
                    e.preventDefault();
                    e.stopPropagation();
                    await markNotificationAsRead(dismissButton.dataset.dismissNotificationId);
                }
            };
        }

        function renderDashboard(lists, notifications = []) {
            const formatted = formatAccessibleLists(lists);
            const ownedLists = formatted.created_by_me;
            const sharedLists = formatted.shared_with_me;

            renderListCollection(
                'owned-lists-cards',
                ownedLists,
                'owner',
                'Nu ai încă liste create. Poți genera prima listă din butonul Create New List.'
            );
            renderListCollection(
                'shared-lists-cards',
                sharedLists,
                'shared',
                'Nu există încă liste partajate cu acest utilizator.'
            );
            renderRecentActivity(notifications, ownedLists, sharedLists);
        }

        async function markNotificationAsRead(notificationId) {
            try {
                await makeRequest('PATCH', `/notifications/${notificationId}`, null, token);
                currentNotifications = Array.isArray(currentNotifications)
                    ? currentNotifications.map((notification) => (
                        notification.id === notificationId
                            ? { ...notification, read: true }
                            : notification
                    ))
                    : [];
                renderDashboard(currentLists, currentNotifications);
                renderNotificationsFeed(currentNotifications, currentLists);
                await refreshDashboard();
            } catch (error) {
                console.error('Eroare la marcare notificare:', error);
            }
        }

        function getOverBudgetAlertListIds(lists) {
            const formatted = formatAccessibleLists(lists);
            const allLists = [...formatted.created_by_me, ...formatted.shared_with_me];

            return allLists
                .filter((list) => getBudgetSnapshotMeta(list.budget_snapshot, list.max_budget).status === 'over_budget')
                .map((list) => list.id);
        }

        async function attachBudgetsToLists(lists) {
            if (!Array.isArray(lists) || lists.length === 0) {
                return [];
            }

            return Promise.all(lists.map(async (list) => {
                try {
                    const budgetSnapshot = await makeRequest('GET', `/lists/${list.id}/budget`, null, token);
                    return {
                        ...list,
                        budget_snapshot: budgetSnapshot,
                    };
                } catch {
                    return {
                        ...list,
                        budget_snapshot: null,
                    };
                }
            }));
        }

        async function attachItemsToLists(lists) {
            if (!Array.isArray(lists) || lists.length === 0) {
                return [];
            }

            return Promise.all(lists.map(async (list) => {
                try {
                    const items = await makeRequest('GET', `/lists/${list.id}/items`, null, token);
                    return {
                        ...list,
                        items: Array.isArray(items) ? items : [],
                    };
                } catch {
                    return {
                        ...list,
                        items: [],
                    };
                }
            }));
        }

        async function refreshDashboard() {
            if (!token) {
                return;
            }

            updateStatus('Reîmprospătare dashboard...');

            try {
                const lists = await makeRequest('GET', '/lists/accessible', null, token);
                const enrichedLists = await enrichAccessibleLists(Array.isArray(lists) ? lists : []);
                const listsWithItems = await attachItemsToLists(enrichedLists);
                currentLists = await attachBudgetsToLists(listsWithItems);
                populateListSelect(currentLists);

                let notifications = [];
                try {
                    const loadedNotifications = await makeRequest('GET', '/notifications', null, token);
                    notifications = Array.isArray(loadedNotifications) ? loadedNotifications : [];
                } catch {
                    notifications = [];
                }

                currentNotifications = notifications;
                renderDashboard(currentLists, currentNotifications);
                renderNotificationsFeed(currentNotifications, currentLists);
                if (activeWorkspaceSection === 'my-lists') {
                    await renderMyListsSection(myListId);
                }
                updateStatus('Dashboard actualizat');
            } catch (error) {
                if (isAuthError(error)) {
                    endUserSession('Sesiunea a expirat. Autentifică-te din nou.');
                    throw error;
                }

                updateStatus('Eroare la actualizare dashboard');
                renderRecentActivity([], [], []);
                console.error('Eroare la actualizare dashboard:', error);
            }
        }

        function openListFromDashboard(selectedListId) {
            listId = selectedListId;
            const select = document.getElementById('list-select');
            if (select) {
                select.value = selectedListId;
            }
            openMyLists(selectedListId);
        }

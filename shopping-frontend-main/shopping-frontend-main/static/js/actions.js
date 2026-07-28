        async function registerUser() {
            try {
                const user1Credentials = getUser1Credentials();
                validateCredentials(user1Credentials, 'utilizatorul');
                showResponse('register-response', '', true);
                document.getElementById('register-response').classList.add('hidden');

                await makeRequest('POST', '/auth/register', {
                    email: user1Credentials.email,
                    password: user1Credentials.password
                });

                showResponse('register-response', 'Utilizator înregistrat cu succes. Te poți autentifica acum.');
            } catch (error) {
                if (error.message.includes('already exists')) {
                    showResponse('register-response', 'Utilizatorul există deja.', false);
                } else {
                    showResponse('register-response', error.message, false);
                }
            }
        }

        async function loginUser1() {
            try {
                const user1 = getLoginUser1Credentials();
                validateCredentials(user1, 'utilizatorul');

                const response = await makeRequest('POST', '/auth/login', {
                    email: user1.email,
                    password: user1.password
                });

                token = response.access_token;
                currentUserId = response.user.id;
                document.getElementById('token-display').textContent = token;
                showWorkspaceForUser(response.user.email);
                saveSession(response.user.email);
                updateStatus('Utilizator autentificat');
                refreshDashboard();
            } catch (error) {
                alert(error.message);
            }
        }

        async function loginUser2() {
            updateStatus('Login user2...');
            try {
                const user2 = getUser2Credentials();
                validateCredentials(user2, 'utilizatorul 2');

                const response = await makeRequest('POST', '/auth/login', {
                    email: user2.email,
                    password: user2.password
                });

                token2 = response.access_token;
                document.getElementById('token2-display').textContent = token2;
                updateStatus('User2 autentificat');
            } catch (error) {
                alert(error.message);
                updateStatus('Eroare la login user2');
            }
        }

        async function createList(source = 'drawer') {
            if (!token) {
                alert('Trebuie să faci login mai întâi.');
                return;
            }

            updateStatus('Creare listă...');
            try {
                const fieldIds = getCreateListFieldIds(source);
                const responseId = source === 'drawer' ? 'create-list-drawer-response' : 'lists-response';
                const budgetRawValue = getInputValue(fieldIds.budget);
                const newList = getCreateListPayload(source);

                clearCreateListResponse(source);
                if (!newList.name) {
                    throw new Error('Completează numele listei.');
                }
                if (!budgetRawValue || Number.isNaN(newList.max_budget) || newList.max_budget < 0) {
                    throw new Error('Completează un max budget valid.');
                }

                const existingLists = await makeRequest('GET', '/lists', null, token);
                currentLists = Array.isArray(existingLists) ? existingLists : [];

                const duplicate = currentLists.find(
                    (list) => list.name.trim().toLowerCase() === newList.name.trim().toLowerCase()
                );
                if (duplicate) {
                    throw new Error(`Lista '${newList.name}' există deja.`);
                }

                const createdList = await makeRequest('POST', '/lists', newList, token);
                currentLists.push(createdList);
                listId = createdList.id;
                if (source === 'control-center') {
                    const listIdDisplay = document.getElementById('listid-display');
                    if (listIdDisplay) {
                        listIdDisplay.classList.remove('hidden');
                        listIdDisplay.textContent = `List ID: ${listId}`;
                    }
                }

                populateListSelect(currentLists);
                showResponse(responseId, createdList);
                updateStatus('Listă creată');
                refreshDashboard();
                if (source === 'drawer') {
                    closeCreateListDrawer();
                }
                openMyLists(createdList.id);
            } catch (error) {
                showResponse(source === 'drawer' ? 'create-list-drawer-response' : 'lists-response', error.message, false);
                updateStatus('Eroare la creare listă');
            }
        }

        async function loadAccessibleLists() {
            if (!token) {
                alert('Trebuie să faci login mai întâi.');
                return;
            }

            updateStatus('Încărcare liste accesibile...');
            try {
                const lists = await makeRequest('GET', '/lists/accessible', null, token);
                currentLists = Array.isArray(lists) ? lists : [];
                populateListSelect(currentLists);
                showResponse('accessible-lists-response', formatAccessibleLists(currentLists));
                renderDashboard(currentLists, currentNotifications);
                updateStatus('Liste accesibile încărcate');
            } catch (error) {
                showResponse('accessible-lists-response', error.message, false);
                updateStatus('Eroare la încărcare liste accesibile');
            }
        }

        async function addItem() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            updateStatus('Adăugare articol...');
            try {
                const item = getCreateItemPayload();
                if (!item.name) {
                    throw new Error('Completează numele articolului.');
                }
                if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                    throw new Error('Completează o cantitate validă.');
                }
                if (Number.isNaN(item.estimated_price) || item.estimated_price < 0) {
                    throw new Error('Completează un preț estimat valid.');
                }

                currentItems = await makeRequest('GET', `/lists/${listId}/items`, null, token);
                currentItems = Array.isArray(currentItems) ? currentItems : [];

                const duplicate = currentItems.find(
                    (existing) => existing.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                );

                if (duplicate) {
                    throw new Error(`Articolul '${item.name}' există deja în listă.`);
                }

                const result = await makeRequest('POST', `/lists/${listId}/items`, item, token);
                currentItems.push(result);
                populateItemSelect(currentItems);

                showResponse('list-select-response', {
                    message: 'Articol adăugat cu succes',
                    item: result,
                });
                updateStatus('Articol adăugat');
                refreshDashboard();
                if (activeWorkspaceSection === 'my-lists') {
                    renderMyListsSection(myListId || listId);
                }
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la adăugare articol');
            }
        }

        async function shareList() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            updateStatus('Partajare listă...');
            try {
                const user2 = getUser2Credentials();
                validateCredentials(user2, 'utilizatorul 2');

                await makeRequest('POST', `/lists/${listId}/share`, {
                    user_email: user2.email,
                    role: 'editor'
                }, token);

                showResponse('share-response', `Listă partajată cu ${user2.email} ca editor`);
                updateStatus('Listă partajată');
                refreshDashboard();
            } catch (error) {
                showResponse('share-response', error.message, false);
                updateStatus('Eroare la partajare');
            }
        }

        async function getLists() {
            if (!token) {
                alert('Trebuie să faci login mai întâi.');
                return;
            }

            updateStatus('Obținere liste...');
            try {
                const lists = await makeRequest('GET', '/lists', null, token);
                currentLists = Array.isArray(lists) ? lists : [];
                populateListSelect(currentLists);
                showResponse('additional-response', currentLists);
                updateStatus('Liste obținute');
            } catch (error) {
                showResponse('additional-response', error.message, false);
                updateStatus('Eroare la obținere liste');
            }
        }

        function populateListSelect(lists) {
            const select = document.getElementById('list-select');
            if (!select) {
                return;
            }

            select.innerHTML = '';

            if (!Array.isArray(lists) || lists.length === 0) {
                select.classList.add('hidden');
                return;
            }

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Alege o listă...';
            select.appendChild(placeholder);

            for (const list of lists) {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = `${list.name} (${list.id})`;
                select.appendChild(option);
            }

            select.classList.remove('hidden');
        }

        function onListSelectChange() {
            const select = document.getElementById('list-select');
            if (!select) {
                return;
            }

            const selected = select.value;
            if (selected) {
                listId = selected;
            }
        }

        async function loadLists() {
            await getLists();
        }

        async function displayItemsForSelectedList() {
            if (!token) {
                alert('Trebuie să faci login mai întâi.');
                return;
            }

            if (!listId) {
                alert('Trebuie să selectezi mai întâi o listă din dropdown.');
                return;
            }

            updateStatus('Afișare articole pentru lista selectată...');
            try {
                const items = await makeRequest('GET', `/lists/${listId}/items`, null, token);
                currentItems = Array.isArray(items) ? items : [];
                populateItemSelect(currentItems);
                showResponse('list-select-response', items);
                updateStatus('Articole afișate pentru lista selectată');
                if (activeWorkspaceSection === 'my-lists') {
                    currentMyListItems = currentItems;
                }
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la afișare articole');
            }
        }

        async function getNotifications() {
            if (!token2) {
                await loginUser2();
            }

            if (!token2) {
                return;
            }

            updateStatus('Obținere notificări...');
            try {
                const notifications = await makeRequest('GET', '/notifications', null, token2);
                showResponse('additional-response', notifications);
                currentNotifications = Array.isArray(notifications) ? notifications : [];
                renderRecentActivity(currentNotifications, formatAccessibleLists(currentLists).created_by_me, formatAccessibleLists(currentLists).shared_with_me);
                renderNotificationsFeed(currentNotifications, currentLists);
                updateStatus('Notificări obținute');
            } catch (error) {
                showResponse('additional-response', error.message, false);
                updateStatus('Eroare la obținere notificări');
            }
        }

        async function updateList() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            updateStatus('Actualizare listă...');
            try {
                const name = getInputValue('update-list-name');
                const budgetRaw = getInputValue('update-list-budget');
                let listResponse = null;
                let budgetResponse = null;

                if (name) {
                    listResponse = await makeRequest('PATCH', `/lists/${listId}`, { name }, token);
                }

                if (budgetRaw) {
                    const parsedBudget = Number(budgetRaw);
                    if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
                        throw new Error('Completează un max budget valid.');
                    }
                    budgetResponse = await makeRequest('PATCH', `/lists/${listId}/budget`, { max_budget: parsedBudget }, token);
                }

                if (!name && !budgetRaw) {
                    throw new Error('Completează cel puțin un câmp pentru actualizare.');
                }

                showResponse('list-select-response', budgetResponse || listResponse || 'Listă actualizată');
                updateStatus('Listă actualizată');
                refreshDashboard();
                if (activeWorkspaceSection === 'my-lists') {
                    renderMyListsSection(myListId || listId);
                }
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la actualizare listă');
            }
        }

        async function deleteList() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            if (!confirm('Ești sigur că vrei să ștergi lista?')) return;

            updateStatus('Ștergere listă...');
            try {
                const deletedListId = listId;
                await makeRequest('DELETE', `/lists/${listId}`, null, token);
                showResponse('list-select-response', 'Listă ștearsă');
                listId = '';
                currentLists = Array.isArray(currentLists)
                    ? currentLists.filter((entry) => entry.id !== deletedListId)
                    : currentLists;
                if (myListId === deletedListId) {
                    myListId = '';
                }
                const listIdDisplay = document.getElementById('listid-display');
                if (listIdDisplay) {
                    listIdDisplay.classList.add('hidden');
                }
                updateStatus('Listă ștearsă');
                if (activeWorkspaceSection === 'my-lists') {
                    await renderMyListsSection();
                }
                await refreshDashboard();
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la ștergere listă');
            }
        }

        async function updateItem() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            updateStatus('Actualizare articol...');
            try {
                const itemId = getSelectedItemId();
                if (!itemId) {
                    throw new Error('Selectează un articol mai întâi.');
                }

                const payload = {};
                const name = getInputValue('update-item-name');
                const quantityRaw = getInputValue('update-item-quantity');
                const priceRaw = getInputValue('update-item-price');

                if (name) {
                    payload.name = name;
                }
                if (quantityRaw) {
                    const parsedQuantity = Number(quantityRaw);
                    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
                        throw new Error('Completează o cantitate validă.');
                    }
                    payload.quantity = parsedQuantity;
                }
                if (priceRaw) {
                    const parsedPrice = Number(priceRaw);
                    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
                        throw new Error('Completează un preț estimat valid.');
                    }
                    payload.estimated_price = parsedPrice;
                }
                if (Object.keys(payload).length === 0) {
                    throw new Error('Completează cel puțin un câmp pentru actualizare.');
                }

                const result = await makeRequest('PATCH', `/lists/${listId}/items/${itemId}`, payload, token);
                currentItems = await makeRequest('GET', `/lists/${listId}/items`, null, token);
                currentItems = Array.isArray(currentItems) ? currentItems : [];
                populateItemSelect(currentItems);
                showResponse('list-select-response', result);
                updateStatus('Articol actualizat');
                refreshDashboard();
                if (activeWorkspaceSection === 'my-lists') {
                    renderMyListsSection(myListId || listId);
                }
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la actualizare articol');
            }
        }

        async function deleteItem() {
            if (!token || !listId) {
                alert('Trebuie să selectezi o listă mai întâi.');
                return;
            }

            updateStatus('Ștergere articol...');
            try {
                const itemId = getSelectedItemId();
                if (!itemId) {
                    throw new Error('Selectează un articol mai întâi.');
                }

                await makeRequest('DELETE', `/lists/${listId}/items/${itemId}`, null, token);
                currentItems = await makeRequest('GET', `/lists/${listId}/items`, null, token);
                currentItems = Array.isArray(currentItems) ? currentItems : [];
                populateItemSelect(currentItems);
                showResponse('list-select-response', 'Articol șters');
                updateStatus('Articol șters');
                refreshDashboard();
                if (activeWorkspaceSection === 'my-lists') {
                    renderMyListsSection(myListId || listId);
                }
            } catch (error) {
                showResponse('list-select-response', error.message, false);
                updateStatus('Eroare la ștergere articol');
            }
        }

        async function deleteItemFromMyList(itemId) {
            if (!token || !myListId) {
                return;
            }

            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să modifici produsele din această listă');
                return;
            }

            try {
                await makeRequest('DELETE', `/lists/${myListId}/items/${itemId}`, null, token);
                await renderMyListsSection(myListId);
                await refreshDashboard();
                updateStatus('Articol șters din My Lists');
            } catch (error) {
                updateStatus('Eroare la ștergere articol');
            }
        }

        async function toggleMyListItemChecked(itemId, checked) {
            if (!token || !myListId) {
                return;
            }

            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să modifici produsele din această listă');
                return;
            }

            updateStatus(checked ? 'Se bifează produsul...' : 'Se debifează produsul...');

            try {
                await makeRequest('PATCH', `/lists/${myListId}/items/${itemId}`, { checked }, token);
                await refreshDashboard();
                await renderMyListsSection(myListId);
                updateStatus(checked ? 'Produs bifat' : 'Produs debifat');
            } catch (error) {
                updateStatus('Eroare la actualizare produs');
                showResponse('list-select-response', error.message, false);
            }
        }

        async function startMyListItemEdit(itemId) {
            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să editezi produsele din această listă');
                return;
            }

            editingMyListItemId = itemId;
            showingMyListQuickAddForm = false;
            await renderMyListsSection(myListId);
            const nameInput = document.getElementById(`edit-item-name-${itemId}`);
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }

        function handleMyListItemEditKeydown(event, itemId) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveMyListItemEdit(itemId);
            }
        }

        async function saveMyListItemEdit(itemId) {
            if (!token || !myListId) {
                return;
            }

            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să editezi produsele din această listă');
                return;
            }

            const name = getInputValue(`edit-item-name-${itemId}`);
            const quantityRaw = getInputValue(`edit-item-quantity-${itemId}`);
            const priceRaw = getInputValue(`edit-item-price-${itemId}`);
            const payload = {};

            if (name) {
                payload.name = name;
            }

            if (quantityRaw !== '') {
                const parsedQuantity = Number(quantityRaw);
                if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
                    updateStatus('Cantitate invalidă');
                    return;
                }
                payload.quantity = parsedQuantity;
            }

            if (priceRaw !== '') {
                const parsedPrice = Number(priceRaw);
                if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
                    updateStatus('Preț invalid');
                    return;
                }
                payload.estimated_price = parsedPrice;
            }

            if (!payload.name && payload.quantity === undefined && payload.estimated_price === undefined) {
                updateStatus('Completează un nume, o cantitate sau un preț valid');
                return;
            }

            updateStatus('Se actualizează produsul...');

            try {
                await makeRequest('PATCH', `/lists/${myListId}/items/${itemId}`, payload, token);
                editingMyListItemId = null;
                await refreshDashboard();
                await renderMyListsSection(myListId);
                updateStatus('Produs actualizat');
            } catch (error) {
                updateStatus('Eroare la actualizare produs');
                showResponse('list-select-response', error.message, false);
            }
        }

        function submitMyListEdit(event) {
            event.preventDefault();
            updateMyListDetails();
        }

        async function updateMyListDetails(options = {}) {
            const { exitIfUnchanged = false } = options;
            if (!token || !myListId) {
                return;
            }

            if (!canManageCurrentList(getAccessibleMyListById())) {
                updateStatus('Doar proprietarul poate modifica setările listei');
                return;
            }

            const name = getInputValue('my-list-name-input');
            const budgetRaw = getInputValue('my-list-budget-input');
            const currentList = getAccessibleMyListById();
            const normalizedCurrentName = (currentList?.name || '').trim();
            const budgetMeta = getBudgetSnapshotMeta(currentList?.budget_snapshot, currentList?.max_budget);
            const normalizedInputName = name.trim();
            const hasNameChange = Boolean(normalizedInputName) && normalizedInputName !== normalizedCurrentName;
            let hasBudgetChange = false;
            let parsedBudget = null;

            if (budgetRaw !== '') {
                parsedBudget = Number(budgetRaw);
                if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
                    updateStatus('Buget invalid');
                    return;
                }
                hasBudgetChange = parsedBudget !== budgetMeta.maxBudget;
            }

            if (!hasNameChange && !hasBudgetChange) {
                if (exitIfUnchanged) {
                    editingMyListDetails = false;
                    await renderMyListsSection(myListId);
                    return;
                }
                updateStatus('Completează un nume sau un buget nou');
                return;
            }

            updateStatus('Se actualizează lista...');

            try {
                if (hasNameChange) {
                    await makeRequest('PATCH', `/lists/${myListId}`, { name: normalizedInputName }, token);
                }
                if (hasBudgetChange) {
                    await makeRequest('PATCH', `/lists/${myListId}/budget`, { max_budget: parsedBudget }, token);
                }
                editingMyListDetails = false;
                await refreshDashboard();
                await renderMyListsSection(myListId);
                updateStatus('Lista a fost actualizată');
            } catch (error) {
                updateStatus('Eroare la actualizare listă');
                showResponse('list-select-response', error.message, false);
            }
        }

        async function deleteMyCurrentList() {
            if (!myListId) {
                return;
            }

            if (!canManageCurrentList(getAccessibleMyListById())) {
                updateStatus('Doar proprietarul poate șterge lista');
                return;
            }

            listId = myListId;
            await deleteList();
        }

        function submitMyListQuickAdd(event) {
            event.preventDefault();
            addItemFromMyListPanel();
        }

        async function addItemFromMyListPanel() {
            if (!token || !myListId) {
                return;
            }

            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să adaugi produse în această listă');
                return;
            }

            const name = getInputValue('quick-add-item-name');
            const quantityRaw = getInputValue('quick-add-item-quantity');
            const priceRaw = getInputValue('quick-add-item-price');

            if (!name) {
                updateStatus('Completează numele produsului');
                return;
            }

            const quantity = Number(quantityRaw);
            if (!Number.isInteger(quantity) || quantity <= 0) {
                updateStatus('Cantitate invalidă');
                return;
            }

            const estimatedPrice = Number(priceRaw);
            if (Number.isNaN(estimatedPrice) || estimatedPrice < 0) {
                updateStatus('Preț invalid');
                return;
            }

            updateStatus('Se adaugă produsul...');

            try {
                const existingItems = await makeRequest('GET', `/lists/${myListId}/items`, null, token);
                const safeItems = Array.isArray(existingItems) ? existingItems : [];
                const duplicate = safeItems.find(
                    (item) => (item.name || '').trim().toLowerCase() === name.trim().toLowerCase()
                );

                if (duplicate) {
                    updateStatus(`Produsul '${name}' există deja în listă`);
                    return;
                }

                await makeRequest('POST', `/lists/${myListId}/items`, {
                    name,
                    quantity,
                    estimated_price: estimatedPrice,
                }, token);

                const nameInput = document.getElementById('quick-add-item-name');
                const quantityInput = document.getElementById('quick-add-item-quantity');
                const priceInput = document.getElementById('quick-add-item-price');
                nameInput.value = '';
                quantityInput.value = '1';
                priceInput.value = '';

                showingMyListQuickAddForm = false;
                await refreshDashboard();
                await renderMyListsSection(myListId);
                updateStatus('Produs adăugat');
            } catch (error) {
                updateStatus('Eroare la adăugare produs');
                showResponse('list-select-response', error.message, false);
            }
        }

        async function bulkCheckMyListItems(checked) {
            if (!token || !myListId) {
                return;
            }

            if (!canEditCurrentListItems(getAccessibleMyListById())) {
                updateStatus('Nu ai permisiunea să modifici produsele din această listă');
                return;
            }

            updateStatus(checked ? 'Se bifează toate produsele...' : 'Se debifează toate produsele...');

            try {
                await makeRequest('POST', `/lists/${myListId}/items/bulk-check?checked=${checked ? 'true' : 'false'}`, null, token);
                editingMyListItemId = null;
                showingMyListQuickAddForm = false;
                await refreshDashboard();
                await renderMyListsSection(myListId);
                updateStatus(checked ? 'Toate produsele au fost bifate' : 'Toate produsele au fost debifate');
            } catch (error) {
                updateStatus('Eroare la actualizarea produselor');
                alert(error.message);
            }
        }

        async function leaveCurrentSharedList() {
            if (!token || !myListId) {
                return;
            }

            const currentList = getAccessibleMyListById();
            if (canManageCurrentList(currentList)) {
                updateStatus('Proprietarul nu poate părăsi propria listă');
                return;
            }

            if (!confirm('Vrei să ieși din această listă partajată?')) {
                return;
            }

            updateStatus('Se părăsește lista...');

            try {
                await makeRequest('DELETE', `/lists/${myListId}/leave`, null, token);
                editingMyListDetails = false;
                editingMyListItemId = null;
                showingMyListQuickAddForm = false;
                myListId = '';
                listId = '';
                await refreshDashboard();
                await openMyLists();
                updateStatus('Ai ieșit din lista partajată');
            } catch (error) {
                updateStatus('Eroare la părăsirea listei');
                alert(error.message);
            }
        }

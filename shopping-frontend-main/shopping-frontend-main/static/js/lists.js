        let currentMyListComments = [];
        let myListCommentMode = false;
        let myListCommentDraft = null;
        let myListCommentSelection = null;
        let myListCommentSelectionCleanup = null;
        let myListCommentDrag = null;
        let myListCommentSuppressToggleId = null;
        const collapsedMyListCommentIds = new Set();

        function populateMyListPicker(lists) {
            const picker = document.getElementById('my-list-picker');
            const activeCount = document.getElementById('my-list-active-count');
            picker.innerHTML = '';

            const { created_by_me: ownedLists, shared_with_me: sharedLists } = formatAccessibleLists(lists);
            const accessibleLists = [...ownedLists, ...sharedLists];
            if (activeCount) {
                activeCount.textContent = `${accessibleLists.length} ${accessibleLists.length === 1 ? 'listă activă' : 'liste active'}`;
            }
            if (!accessibleLists.length) {
                picker.classList.add('hidden');
                return;
            }

            const appendOptions = (label, groupedLists) => {
                if (!groupedLists.length) {
                    return;
                }

                const group = document.createElement('optgroup');
                group.label = label;

                for (const list of groupedLists) {
                    const option = document.createElement('option');
                    option.value = list.id;
                    option.textContent = list.name;
                    group.appendChild(option);
                }

                picker.appendChild(group);
            };

            appendOptions('Listele mele', ownedLists);
            appendOptions('Partajate cu mine', sharedLists);

            if (!myListId || !accessibleLists.some((list) => list.id === myListId)) {
                myListId = accessibleLists[0].id;
            }

            picker.value = myListId;
            picker.classList.remove('hidden');
        }

        function getAccessibleListsForMyLists(lists = currentLists) {
            const { created_by_me: ownedLists, shared_with_me: sharedLists } = formatAccessibleLists(lists);
            return [...ownedLists, ...sharedLists];
        }

        function getAccessibleMyListById(selectedListId = myListId) {
            return getAccessibleListsForMyLists().find((list) => list.id === selectedListId) || null;
        }

        function getListRole(list) {
            if (!list) {
                return 'viewer';
            }

            return list.owner_id === currentUserId ? 'owner' : (list.access_role || 'viewer');
        }

        function canManageCurrentList(list) {
            return getListRole(list) === 'owner';
        }

        function canEditCurrentListItems(list) {
            const role = getListRole(list);
            return role === 'owner' || role === 'editor';
        }

        function getMyListRoleBadge(list) {
            const role = getListRole(list);
            if (role === 'owner') {
                return { text: 'OWNER', className: 'badge-owner' };
            }

            return {
                text: role === 'editor' ? 'EDITOR' : 'VIEWER',
                className: 'badge-shared',
            };
        }

        function buildMyListItem(item, index, completed = false, canEditItems = true) {
            const quantity = toNumber(item.quantity) || 1;
            const estimatedPrice = toNumber(item.estimated_price);
            const quantityLabel = `${quantity} buc.`;
            const nextCheckedState = !Boolean(item.checked);
            const isEditing = canEditItems && editingMyListItemId === item.id;
            const nameMarkup = isEditing
                ? `
                    <input
                        id="edit-item-name-${item.id}"
                        type="text"
                        class="my-list-item-inline-input"
                        value="${escapeAttribute(item.name || '')}"
                        onkeydown="handleMyListItemEditKeydown(event, '${item.id}')"
                    >
                    <div class="my-list-item-meta-line">
                        <span>${quantityLabel}</span>
                    </div>
                `
                : `
                    <strong class="${completed ? 'completed' : ''}">${item.name || 'Articol fără nume'}</strong>
                    <div class="my-list-item-meta-line">
                        <span>${quantityLabel}</span>
                    </div>
                `;
            const priceMarkup = isEditing
                ? `
                    <input
                        id="edit-item-quantity-${item.id}"
                        type="number"
                        min="1"
                        step="1"
                        class="my-list-item-inline-quantity"
                        value="${escapeAttribute(quantity)}"
                        onkeydown="handleMyListItemEditKeydown(event, '${item.id}')"
                    >
                    <input
                        id="edit-item-price-${item.id}"
                        type="number"
                        step="0.01"
                        min="0"
                        class="my-list-item-inline-price"
                        value="${escapeAttribute(estimatedPrice)}"
                        onkeydown="handleMyListItemEditKeydown(event, '${item.id}')"
                    >
                    <span>${quantityLabel}</span>
                `
                : `
                    <strong class="${completed ? 'completed' : ''}">${formatCurrency(estimatedPrice)}</strong>
                    <span>${quantityLabel}</span>
                `;
            const editButtonMarkup = isEditing
                ? `<button type="button" class="my-list-item-edit save" onclick="saveMyListItemEdit('${item.id}')">Save</button>`
                : canEditItems
                    ? `<button type="button" class="my-list-item-edit" onclick="startMyListItemEdit('${item.id}')">✎</button>`
                    : '';
            const checkboxMarkup = canEditItems
                ? `
                    <button
                        type="button"
                        class="check-visual ${completed ? 'checked' : ''}"
                        onclick="toggleMyListItemChecked('${item.id}', ${nextCheckedState})"
                        aria-label="${completed ? 'Debifează produsul' : 'Bifează produsul'}"
                    ></button>
                `
                : `<span class="check-visual ${completed ? 'checked' : ''} placeholder">${completed ? '✓' : ''}</span>`;
            const deleteButtonMarkup = canEditItems
                ? `<button type="button" class="my-list-item-delete" onclick="deleteItemFromMyList('${item.id}')">🗑</button>`
                : '';

            return `
                <article class="my-list-item ${completed ? 'completed' : ''}">
                    <span class="drag-dot">${completed ? '' : '⋮'}</span>
                    ${checkboxMarkup}
                    <div class="my-list-item-body">
                        ${nameMarkup}
                    </div>
                    <div class="my-list-item-price">
                        ${priceMarkup}
                    </div>
                    ${editButtonMarkup}
                    ${deleteButtonMarkup}
                </article>
            `;
        }

        function buildItemsBlock(title, items, completed = false, canEditItems = true) {
            if (!items.length) {
                return '';
            }

            return `
                <section class="my-list-category">
                    <h4 class="my-list-category-title">${title}</h4>
                    <div class="my-list-items">
                        ${items.map((item, index) => buildMyListItem(item, index, completed, canEditItems)).join('')}
                    </div>
                </section>
            `;
        }

        function buildMixedItemsBlock(title, items, canEditItems = true) {
            if (!items.length) {
                return '';
            }

            return `
                <section class="my-list-category">
                    <h4 class="my-list-category-title">${title}</h4>
                    <div class="my-list-items">
                        ${items.map((item, index) => buildMyListItem(item, index, Boolean(item.checked), canEditItems)).join('')}
                    </div>
                </section>
            `;
        }

        function buildMyListQuickAddInlineForm() {
            if (!showingMyListQuickAddForm) {
                return '';
            }

            return `
                <form class="my-list-item quick-add-inline" onsubmit="submitMyListQuickAdd(event)">
                    <span class="drag-dot"></span>
                    <span class="check-visual placeholder"></span>
                    <div class="my-list-item-body">
                        <input
                            id="quick-add-item-name"
                            type="text"
                            class="my-list-item-inline-input"
                            placeholder="Nume produs"
                            required
                        >
                        <div class="my-list-item-meta-line">
                            <input
                                id="quick-add-item-quantity"
                                type="number"
                                min="1"
                                step="1"
                                class="my-list-item-inline-quantity"
                                placeholder="Cantitate"
                                value="1"
                                required
                            >
                        </div>
                    </div>
                    <div class="my-list-item-price">
                        <input
                            id="quick-add-item-price"
                            type="number"
                            min="0"
                            step="0.01"
                            class="my-list-item-inline-price"
                            placeholder="Preț estimat"
                            required
                        >
                    </div>
                    <button type="submit" class="my-list-item-edit save">Save</button>
                    <button type="button" class="my-list-item-delete cancel" onclick="hideMyListQuickAddForm()">×</button>
                </form>
            `;
        }

        function escapeAttribute(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function buildSpendingAnalysisCard(analysis) {
            const safeAnalysis = analysis || {};
            const totalItems = toNumber(safeAnalysis.total_items);
            const totalListValue = toNumber(safeAnalysis.total_list_value);
            const averageItemPrice = toNumber(safeAnalysis.average_item_price);
            const mostExpensiveName = safeAnalysis.most_expensive_item?.name || 'Niciun produs';
            const mostExpensivePrice = safeAnalysis.most_expensive_item?.price ?? 0;

            return `
                <section class="spending-analysis-card">
                    <div class="spending-analysis-header">
                        <div>
                            <span class="drawer-eyebrow">Analiză rapidă</span>
                            <h4>Statistici listă</h4>
                        </div>
                        <span class="spending-analysis-currency">${escapeHtml(safeAnalysis.currency || 'RON')}</span>
                    </div>
                    <div class="spending-analysis-grid">
                        <article class="spending-stat">
                            <span>Total produse</span>
                            <strong>${totalItems}</strong>
                        </article>
                        <article class="spending-stat">
                            <span>Valoare listă</span>
                            <strong>${formatCurrency(totalListValue)}</strong>
                        </article>
                        <article class="spending-stat">
                            <span>Medie per produs</span>
                            <strong>${formatCurrency(averageItemPrice)}</strong>
                        </article>
                        <article class="spending-stat">
                            <span>Cel mai scump</span>
                            <strong>${escapeHtml(mostExpensiveName)}</strong>
                            <small>${formatCurrency(mostExpensivePrice)}</small>
                        </article>
                    </div>
                </section>
            `;
        }

        function resetMyListCommentUiState() {
            myListCommentMode = false;
            myListCommentDraft = null;
            myListCommentSelection = null;
            if (typeof myListCommentSelectionCleanup === 'function') {
                myListCommentSelectionCleanup();
            }
            myListCommentSelectionCleanup = null;
        }

        function getMyListCommentAuthor(comment, members = []) {
            if (!comment?.user_id) {
                return 'Comentariu';
            }

            if (comment.user_id === currentUserId) {
                return 'Tu';
            }

            const member = members.find((entry) => entry.user_id === comment.user_id);
            return member?.email ? formatDisplayName(member.email) : 'Colaborator';
        }

        function getInitialsFromLabel(label) {
            const normalized = String(label || '')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('');
            return normalized || 'AN';
        }

        function getRelativeCommentTimestamp(createdAt) {
            if (!createdAt) {
                return 'RECENT';
            }

            const timestamp = new Date(createdAt);
            const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp.getTime()) / 60000));
            if (diffMinutes < 1) {
                return 'ACUM';
            }
            if (diffMinutes < 60) {
                return `ACUM ${diffMinutes} MIN`;
            }
            const diffHours = Math.round(diffMinutes / 60);
            if (diffHours < 24) {
                return `ACUM ${diffHours} H`;
            }
            return timestamp.toLocaleDateString('ro-RO').toUpperCase();
        }

        function normalizeMyListCommentDimensions(widthPercent, heightPercent) {
            return {
                widthPercent: Math.min(0.34, Math.max(0.04, Number(widthPercent || 0))),
                heightPercent: Math.min(0.24, Math.max(0.03, Number(heightPercent || 0))),
            };
        }

        function buildMyListCommentStyle(comment) {
            const normalized = normalizeMyListCommentDimensions(comment.width_percent, comment.height_percent);
            const left = Math.max(0, Math.min(100, Number(comment.x_percent || 0) * 100));
            const top = Math.max(0, Math.min(100, Number(comment.y_percent || 0) * 100));
            const width = Math.max(4, Math.min(100, normalized.widthPercent * 100));
            const height = Math.max(4, Math.min(100, normalized.heightPercent * 100));
            return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;`;
        }

        function buildMyListCommentsLayer(comments = [], members = [], canManageComments = false) {
            if (!Array.isArray(comments) || !comments.length) {
                return '';
            }

            return comments.map((comment) => {
                const authorLabel = getMyListCommentAuthor(comment, members);
                const createdAt = getRelativeCommentTimestamp(comment.created_at);
                const isOwnComment = comment.user_id === currentUserId;
                const canManageThisComment = isOwnComment || canManageComments;
                const isCollapsed = !collapsedMyListCommentIds.has(comment.id);
                const noteClassName = `my-list-comment-note ${isOwnComment ? 'own' : 'readonly'} ${isCollapsed ? 'collapsed' : ''}`;
                const guideButtonMarkup = canManageThisComment
                    ? `
                        <button
                            type="button"
                            class="my-list-comment-control"
                            onclick="toggleMyListCommentGuide('${comment.id}')"
                            aria-label="${isCollapsed ? 'Extinde comentariul' : 'Comprimă comentariul în ghid'}"
                        >${isCollapsed ? '↔' : '▁'}</button>
                    `
                    : '';
                const deleteButtonMarkup = canManageThisComment
                    ? `
                        <button
                            type="button"
                            class="my-list-comment-control danger"
                            onclick="deleteMyListComment('${comment.id}')"
                            aria-label="Șterge comentariul"
                        >×</button>
                    `
                    : '';

                return `
                    <article
                        id="my-list-comment-${comment.id}"
                        class="${noteClassName}"
                        style="${buildMyListCommentStyle(comment)}"
                        ${canManageThisComment ? `onmousedown="startDraggingMyListComment(event, '${comment.id}')"` : ''}
                        ${isCollapsed ? `onclick="handleCollapsedMyListCommentClick('${comment.id}')"` : ''}
                    >
                        <div class="my-list-comment-note-shell">
                        ${isCollapsed ? `
                                <span
                                    class="my-list-comment-collapsed-initials"
                                    title="${escapeHtml(authorLabel)}"
                                    aria-hidden="true"
                                >🗨</span>
                            ` : `
                            <div class="my-list-comment-note-handle">
                                <div class="my-list-comment-note-kicker">
                                    <span class="my-list-comment-note-drag">⋮⋮</span>
                                </div>
                                <div class="my-list-comment-note-controls">
                                    ${guideButtonMarkup}
                                    ${deleteButtonMarkup}
                                </div>
                            </div>
                            <div class="my-list-comment-note-body">
                                <span
                                    class="my-list-comment-note-avatar"
                                    title="${escapeHtml(authorLabel)}"
                                    aria-hidden="true"
                                >🗨</span>
                                <div class="my-list-comment-note-copy">
                                    <div class="my-list-comment-note-headline">
                                        <strong>${escapeHtml(authorLabel)}</strong>
                                        <small>${createdAt}</small>
                                    </div>
                                    <p>${escapeHtml(comment.content || '')}</p>
                                </div>
                            </div>
                            `}
                        </div>
                    </article>
                `;
            }).join('');
        }

        function buildMyListCommentDraftBox() {
            if (!myListCommentDraft) {
                return '';
            }

            return `
                <div class="my-list-comment-draft" style="${buildMyListCommentStyle(myListCommentDraft)}">
                    <div class="my-list-comment-draft-shell">
                        <div class="my-list-comment-note-handle draft">
                            <div class="my-list-comment-note-kicker">
                                <span class="my-list-comment-note-drag">⋮⋮</span>
                            </div>
                            <div class="my-list-comment-note-controls">
                                <button
                                    type="button"
                                    class="my-list-comment-control"
                                    onclick="cancelMyListCommentDraft()"
                                    aria-label="Anulează comentariul"
                                >×</button>
                                <button
                                    type="button"
                                    class="my-list-comment-control success"
                                    onclick="saveMyListComment()"
                                    aria-label="Salvează comentariul"
                                >✓</button>
                            </div>
                        </div>
                        <textarea id="my-list-comment-textarea" placeholder="Scrie comentariul aici...">${escapeHtml(myListCommentDraft.content || '')}</textarea>
                    </div>
                </div>
            `;
        }

        function renderMyListContent(list, items, members = [], budgetSnapshot = null, spendingAnalysis = null, comments = []) {
            const container = document.getElementById('my-list-content');

            if (!list) {
                container.innerHTML = '<div class="empty-state">Nu există nicio listă disponibilă pentru acest utilizator.</div>';
                return;
            }

            const role = getListRole(list);
            const canManageList = canManageCurrentList(list);
            const canEditItems = canEditCurrentListItems(list);
            const roleBadge = getMyListRoleBadge(list);
            const otherMembersCount = members.filter(m => m.role !== 'owner').length;
            const membersDisplayText = otherMembersCount > 0 ? `<span class="avatar-chip">+${otherMembersCount}</span>` : '';
            const ownerEmail = list.owner_email || members.find((member) => member.role === 'owner')?.email || '';
            const ownerMeta = role === 'owner'
                ? 'Lista îți aparține și poate fi partajată din această pagină.'
                : `Proprietar: ${escapeHtml(ownerEmail ? formatDisplayName(ownerEmail) : 'utilizator indisponibil')}`;
            const budgetMeta = getBudgetSnapshotMeta(budgetSnapshot || list.budget_snapshot, list.max_budget);
            const titleMarkup = canManageList && editingMyListDetails
                ? `
                    <input
                        id="my-list-name-input"
                        type="text"
                        class="my-list-title-input"
                        value="${escapeAttribute(list.name || '')}"
                        placeholder="Nume listă"
                        onkeydown="handleMyListInlineKeydown(event)"
                    >
                `
                : `<h3>${escapeHtml(list.name || 'Listă fără nume')}</h3>`;
            const budgetMarkup = canManageList && editingMyListDetails
                ? `
                    <input
                        id="my-list-budget-input"
                        type="number"
                        class="my-list-budget-input"
                        step="0.01"
                        min="0"
                        value="${escapeAttribute(budgetMeta.maxBudget)}"
                        placeholder="Limită buget"
                        onkeydown="handleMyListInlineKeydown(event)"
                    >
                `
                : `<strong>${formatCurrency(budgetMeta.maxBudget)}</strong>`;
            const editButtonMarkup = !canManageList
                ? ''
                : `
                    <button
                        type="button"
                        class="icon-action ${editingMyListDetails ? 'icon-action-editing' : ''}"
                        onclick="focusMyListEditForm()"
                        aria-label="${editingMyListDetails ? 'Salvează modificările listei' : 'Editează lista'}"
                        title="${editingMyListDetails ? 'Salvează modificările listei' : 'Editează lista'}"
                    >✎</button>
                `;
            const leaveButtonMarkup = !canManageList
                ? `<button type="button" class="icon-action icon-action-danger" onclick="leaveCurrentSharedList()" aria-label="Ieși din listă">⇦</button>`
                : '';
            const deleteButtonMarkup = canManageList
                ? `<button type="button" class="icon-action icon-action-danger" onclick="deleteMyCurrentList()">🗑</button>`
                : '';
            const commentButtonMarkup = `
                <button
                    type="button"
                    class="icon-action ${myListCommentMode ? 'icon-action-active' : ''}"
                    onclick="toggleMyListCommentMode()"
                    aria-label="${myListCommentMode ? 'Anulează adăugarea comentariului' : 'Adaugă comentariu'}"
                    title="${myListCommentMode ? 'Anulează adăugarea comentariului' : 'Adaugă comentariu'}"
                >🗨</button>
            `;
            const manageMembersButtonLabel = canManageList ? 'Gestionează accesul' : 'Vezi participanții';
            const allItemsBlock = buildMixedItemsBlock('Articole de cumpărat', items, canEditItems);
            const hasItems = items.length > 0;
            const allItemsChecked = hasItems && items.every((item) => item.checked);
            const bulkToggleMarkup = canEditItems && hasItems
                ? `
                    <button
                        type="button"
                        class="my-list-bulk-toggle ${allItemsChecked ? 'checked' : ''}"
                        onclick="bulkCheckMyListItems(${allItemsChecked ? 'false' : 'true'})"
                        aria-label="${allItemsChecked ? 'Debifează toate produsele' : 'Bifează toate produsele'}"
                    >
                        <span class="check-visual ${allItemsChecked ? 'checked' : ''}" aria-hidden="true"></span>
                        <span class="my-list-bulk-toggle-text">${allItemsChecked ? 'Debifează tot' : 'Bifează tot'}</span>
                    </button>
                `
                : '';
            container.innerHTML = `
                <section class="my-list-comment-stage ${myListCommentMode ? 'comment-mode' : ''}" id="my-list-comment-stage">
                    <div class="my-list-comment-canvas">
                        <div class="my-list-comment-content">
                            <form class="my-list-card" onsubmit="submitMyListEdit(event)">
                                <div class="my-list-header">
                                    <div>
                                        <div class="list-people">
                                            ${titleMarkup}
                                            <span class="badge ${roleBadge.className}">${roleBadge.text}</span>
                                        </div>
                                        <div class="my-list-meta">
                                            <span>📅</span>
                                            <span>${list.created_at ? `Actualizat ${new Date(list.created_at).toLocaleDateString('ro-RO')}` : 'Actualizat recent'}</span>
                                            <span class="bullet">•</span>
                                            <span>${items.length} articole</span>
                                            <span class="bullet">•</span>
                                            <span>${comments.length} comentarii</span>
                                            <span class="bullet">•</span>
                                            <span>${ownerMeta}</span>
                                        </div>
                                    </div>
                                    <div class="my-list-actions">
                                        <button type="button" class="icon-action" onclick="openMembersModal('${list.id}')">↗</button>
                                        ${commentButtonMarkup}
                                        ${leaveButtonMarkup}
                                        ${editButtonMarkup}
                                        ${deleteButtonMarkup}
                                    </div>
                                </div>

                                <div class="budget-hero-grid">
                                    <div class="budget-hero-head">
                                        <div class="budget-hero-group ${budgetMeta.isOverBudget ? 'over' : 'primary'}">
                                            <span class="budget-caption">Estimat</span>
                                            <strong>${formatCurrency(budgetMeta.currentTotal)}</strong>
                                        </div>
                                        <div class="budget-hero-group">
                                            <span class="budget-caption">Limită buget</span>
                                            ${budgetMarkup}
                                        </div>
                                    </div>
                                    <div class="budget-hero-progress">
                                        <span class="budget-progress-bar ${budgetMeta.status}" style="width:${budgetMeta.progress}%"></span>
                                    </div>
                                    <div class="budget-hero-foot">
                                        <span>${budgetMeta.maxBudget > 0 ? `${Math.round(budgetMeta.progress)}% din buget consumat - ${budgetMeta.statusLabel}` : 'Fără limită setată'}</span>
                                        <span class="${budgetMeta.isOverBudget ? 'negative' : 'positive'}">${budgetMeta.isOverBudget ? `${formatCurrency(Math.abs(budgetMeta.remainingBudget))} peste limită` : `${formatCurrency(budgetMeta.remainingBudget)} rămași`}</span>
                                    </div>
                                    ${bulkToggleMarkup}
                                </div>
                            </form>

                            ${allItemsBlock}
                            ${canEditItems ? buildMyListQuickAddInlineForm() : ''}

                            <div class="collab-grid">
                                <div class="collab-card primary">
                                    <div class="avatar-stack">
                                        <span class="avatar-chip">TU</span>
                                        ${membersDisplayText}
                                    </div>
                                    <div class="collab-copy">
                                        <strong>Utilizatori activi</strong>
                                        <button type="button" onclick="openMembersModal('${list.id}')">${manageMembersButtonLabel}</button>
                                    </div>
                                </div>
                                ${canEditItems
                                    ? `
                                        <div class="collab-card secondary quick-add-card">
                                            <div class="quick-add-copy">
                                                <strong>Adaugă produs nou</strong>
                                                <span>Deschide formularul direct sub produsele existente.</span>
                                            </div>
                                            <div class="quick-actions">
                                                <button type="button" class="quick-add-button" onclick="focusMyListQuickAddForm()">Adaugă produs</button>
                                            </div>
                                        </div>
                                    `
                                    : `
                                        <div class="collab-card secondary quick-add-card">
                                            <div class="quick-add-copy">
                                                <strong>Acces doar pentru citire</strong>
                                                <span>Această listă este partajată ca viewer. Poți vedea conținutul, dar nu îl poți modifica.</span>
                                            </div>
                                        </div>
                                    `}
                            </div>

                            ${buildSpendingAnalysisCard(spendingAnalysis)}
                        </div>
                        <div
                            id="my-list-comment-overlay"
                            class="my-list-comment-overlay ${myListCommentMode ? 'active' : ''}"
                            onmousedown="startMyListCommentSelection(event)"
                        ></div>
                        <div id="my-list-comment-selection" class="my-list-comment-selection hidden"></div>
                        ${buildMyListCommentsLayer(comments, members, canEditItems)}
                        ${buildMyListCommentDraftBox()}
                    </div>
                </section>
            `;

            if (myListCommentDraft) {
                const textarea = document.getElementById('my-list-comment-textarea');
                if (textarea) {
                    textarea.focus();
                }
            }
        }

        function getInitialsFromEmail(email) {
            const displayName = formatDisplayName(email);
            const initials = displayName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join('');
            return initials || 'BW';
        }

        function getSharedBudgetState(snapshot, fallbackMaxBudget = 0) {
            const budgetMeta = getBudgetSnapshotMeta(snapshot, fallbackMaxBudget);

            if (budgetMeta.status === 'over_budget') {
                return {
                    progress: budgetMeta.progress,
                    progressLabel: 'over',
                    trackClass: 'over',
                    valueClass: 'over',
                };
            }

            if (budgetMeta.status === 'near_limit') {
                return {
                    progress: budgetMeta.progress,
                    progressLabel: 'warn',
                    trackClass: 'warn',
                    valueClass: 'warn',
                };
            }

            return {
                progress: budgetMeta.progress,
                progressLabel: budgetMeta.maxBudget > 0 ? 'ok' : 'Fără limită',
                trackClass: '',
                valueClass: 'ok',
            };
        }

        async function buildSharedDetail(list) {
            const [items, members, budgetSnapshot] = await Promise.all([
                makeRequest('GET', `/lists/${list.id}/items`, null, token),
                makeRequest('GET', `/lists/${list.id}/members`, null, token),
                makeRequest('GET', `/lists/${list.id}/budget`, null, token),
            ]);

            const safeItems = Array.isArray(items) ? items : [];
            const safeMembers = Array.isArray(members) ? members : [];
            const owner = safeMembers.find((member) => member.role === 'owner');
            const currentMember = safeMembers.find((member) => member.user_id === currentUserId);
            const role = currentMember?.role || 'viewer';
            const budgetMeta = getBudgetSnapshotMeta(budgetSnapshot, list.max_budget);
            const budgetState = getSharedBudgetState(budgetSnapshot, list.max_budget);

            return {
                list,
                items: safeItems,
                owner,
                role,
                budgetSnapshot,
                budgetMeta,
                budgetState,
            };
        }

        function buildSharedDetailCard(detail) {
            const roleLabel = detail.role === 'viewer' ? 'VIEWER' : 'EDITOR';
            const ownerName = detail.owner?.email ? formatDisplayName(detail.owner.email) : 'Proprietar indisponibil';
            const ownerInitials = detail.owner?.email ? getInitialsFromEmail(detail.owner.email) : 'BW';
            const productCountLabel = `${detail.items.length} produse`;
            const budgetValueClass = detail.budgetState.valueClass;
            const budgetTrackClass = detail.budgetState.trackClass;

            return `
                <article class="shared-detail-card">
                    <div class="shared-detail-top">
                        <span class="shared-detail-role ${detail.role === 'viewer' ? 'viewer' : 'editor'}">${roleLabel}</span>
                        <span class="shared-item-count"><span class="icon">🛒</span>${productCountLabel}</span>
                    </div>
                    <div>
                        <h3>${detail.list.name || 'Listă fără nume'}</h3>
                        <div class="shared-owner-row">
                            <span class="shared-owner-avatar">${ownerInitials}</span>
                            <span>Proprietar: <strong>${ownerName}</strong></span>
                        </div>
                    </div>
                    <div class="shared-budget-block">
                        <div class="shared-budget-meta">
                            <strong>Buget consumat</strong>
                            <span class="${budgetValueClass}">${formatCurrency(detail.budgetMeta.currentTotal)} / ${formatCurrency(detail.budgetMeta.maxBudget)}</span>
                        </div>
                        <div class="shared-budget-track">
                            <span class="${budgetTrackClass}" style="width:${detail.budgetState.progress}%"></span>
                        </div>
                    </div>
                    <div class="shared-detail-actions">
                        <button type="button" class="view-all-button" onclick="openSharedListModal('${detail.list.id}')">Deschide</button>
                    </div>
                </article>
            `;
        }

        function buildSharedModalItems(items) {
            if (!Array.isArray(items) || items.length === 0) {
                return '<div class="empty-state">Lista nu conține încă produse.</div>';
            }

            return `
                <section class="my-list-category">
                    <h4 class="my-list-category-title">Produse din listă</h4>
                    <div class="my-list-items">
                        ${items.map((item) => `
                            <article class="my-list-item ${item.checked ? 'completed' : ''}">
                                <div class="check-visual placeholder">${item.checked ? '✓' : ''}</div>
                                <div class="my-list-item-body">
                                    <strong class="${item.checked ? 'completed' : ''}">${escapeHtml(item.name || 'Produs fără nume')}</strong>
                                    <div class="my-list-item-meta-line">
                                        <span>Cantitate: ${toNumber(item.quantity) || 1}</span>
                                        <span class="bullet">•</span>
                                        <span>${item.checked ? 'Finalizat' : 'În așteptare'}</span>
                                    </div>
                                </div>
                                <div class="my-list-item-price">
                                    <strong class="${item.checked ? 'completed' : ''}">${formatCurrency(item.estimated_price)}</strong>
                                    <span>preț estimat</span>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        async function openSharedListModal(selectedListId) {
            const modal = document.getElementById('shared-list-modal');
            const loadingDiv = document.getElementById('shared-list-modal-loading');
            const bodyDiv = document.getElementById('shared-list-modal-body');
            const sharedList = formatAccessibleLists(currentLists).shared_with_me.find((list) => list.id === selectedListId);

            if (!modal || !loadingDiv || !bodyDiv || !sharedList) {
                return;
            }

            modal.classList.remove('hidden');
            loadingDiv.classList.remove('hidden');
            bodyDiv.innerHTML = '';

            try {
                const detail = await buildSharedDetail(sharedList);
                bodyDiv.innerHTML = `
                    <div class="shared-list-modal-summary">
                        <div class="shared-detail-top">
                            <span class="shared-detail-role ${detail.role === 'viewer' ? 'viewer' : 'editor'}">${detail.role === 'viewer' ? 'VIEWER' : 'EDITOR'}</span>
                            <span class="shared-item-count"><span class="icon">🛒</span>${detail.items.length} produse</span>
                        </div>
                        <div>
                            <h3>${escapeHtml(detail.list.name || 'Listă fără nume')}</h3>
                            <div class="shared-owner-row">
                                <span class="shared-owner-avatar">${detail.owner?.email ? getInitialsFromEmail(detail.owner.email) : 'BW'}</span>
                                <span>Proprietar: <strong>${escapeHtml(detail.owner?.email ? formatDisplayName(detail.owner.email) : 'Proprietar indisponibil')}</strong></span>
                            </div>
                        </div>
                        <div class="shared-budget-block">
                            <div class="shared-budget-meta">
                                <strong>Buget consumat</strong>
                                <span class="${detail.budgetState.valueClass}">${formatCurrency(detail.budgetMeta.currentTotal)} / ${formatCurrency(detail.budgetMeta.maxBudget)}</span>
                            </div>
                            <div class="shared-budget-track">
                                <span class="${detail.budgetState.trackClass}" style="width:${detail.budgetState.progress}%"></span>
                            </div>
                        </div>
                    </div>
                    ${buildSharedModalItems(detail.items)}
                `;
            } catch (error) {
                bodyDiv.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Nu s-a putut încărca lista partajată.')}</div>`;
            } finally {
                loadingDiv.classList.add('hidden');
            }
        }

        function closeSharedListModal() {
            const modal = document.getElementById('shared-list-modal');
            const bodyDiv = document.getElementById('shared-list-modal-body');

            if (!modal) {
                return;
            }

            modal.classList.add('hidden');
            if (bodyDiv) {
                bodyDiv.innerHTML = '';
            }
        }

        async function renderSharedSection() {
            await renderMyListsSection();
        }

        async function renderMyListsSection(forceListId = null) {
            const accessibleLists = getAccessibleListsForMyLists();
            if (!accessibleLists.length) {
                resetMyListCommentUiState();
                currentMyListComments = [];
                document.getElementById('my-list-content').innerHTML = '<div class="empty-state">Nu ai încă liste proprii sau partajate. Creează una nouă sau cere acces la o listă existentă.</div>';
                document.getElementById('my-list-picker').classList.add('hidden');
                return;
            }

            if (forceListId) {
                myListId = forceListId;
            }

            const previousListId = myListId;
            populateMyListPicker(currentLists);

            const selectedList = accessibleLists.find((list) => list.id === myListId) || accessibleLists[0];
            if (previousListId && selectedList.id !== previousListId) {
                resetMyListCommentUiState();
            }
            myListId = selectedList.id;
            listId = selectedList.id;

            try {
                const [items, members, budgetSnapshot, spendingAnalysis, comments] = await Promise.all([
                    makeRequest('GET', `/lists/${myListId}/items`, null, token),
                    makeRequest('GET', `/lists/${myListId}/members`, null, token),
                    makeRequest('GET', `/lists/${myListId}/budget`, null, token),
                    makeRequest('GET', `/lists/${myListId}/spending-analysis`, null, token),
                    makeRequest('GET', `/lists/${myListId}/comments`, null, token),
                ]);
                currentMyListItems = Array.isArray(items) ? items : [];
                currentMembers = Array.isArray(members) ? members : [];
                currentMyListComments = Array.isArray(comments) ? comments : [];
                currentLists = Array.isArray(currentLists)
                    ? currentLists.map((list) => (
                        list.id === myListId
                            ? { ...list, budget_snapshot: budgetSnapshot }
                            : list
                    ))
                    : currentLists;
                renderMyListContent(selectedList, currentMyListItems, currentMembers, budgetSnapshot, spendingAnalysis, currentMyListComments);
            } catch (error) {
                resetMyListCommentUiState();
                currentMyListItems = [];
                currentMembers = [];
                currentMyListComments = [];
                document.getElementById('my-list-content').innerHTML = `<div class="empty-state">${error.message}</div>`;
            }
        }

        async function openMyLists(forceListId = null) {
            setWorkspaceSection('my-lists');
            if (!currentLists.length) {
                await refreshDashboard();
            }
            await renderMyListsSection(forceListId);
        }

        async function focusMyListEditForm() {
            const selectedList = getAccessibleMyListById();
            if (!canManageCurrentList(selectedList)) {
                return;
            }

            if (editingMyListDetails) {
                await updateMyListDetails({ exitIfUnchanged: true });
                return;
            }

            editingMyListDetails = true;
            await renderMyListsSection(myListId);
            const input = document.getElementById('my-list-name-input');
            if (input) {
                input.focus();
                input.select();
            }
        }

        function focusMyListQuickAddForm() {
            const selectedList = getAccessibleMyListById();
            if (!canEditCurrentListItems(selectedList)) {
                return;
            }

            showingMyListQuickAddForm = true;
            renderMyListsSection(myListId);
            const input = document.getElementById('quick-add-item-name');
            if (input) {
                input.focus();
            }
        }

        function hideMyListQuickAddForm() {
            showingMyListQuickAddForm = false;
            renderMyListsSection(myListId);
        }

        function handleMyListInlineKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        }

        async function openNotifications() {
            setWorkspaceSection('notifications');
            if (!currentLists.length || !currentNotifications.length) {
                await refreshDashboard();
            } else {
                renderNotificationsFeed(currentNotifications, currentLists);
            }
        }

        async function openSharedWithMe() {
            await openMyLists();
        }

        function onMyListPickerChange() {
            const picker = document.getElementById('my-list-picker');
            myListId = picker.value;
            editingMyListDetails = false;
            editingMyListItemId = null;
            showingMyListQuickAddForm = false;
            resetMyListCommentUiState();
            renderMyListsSection();
        }

        function toggleMyListCommentMode() {
            myListCommentMode = !myListCommentMode;
            myListCommentDraft = null;
            myListCommentSelection = null;
            if (!myListCommentMode && typeof myListCommentSelectionCleanup === 'function') {
                myListCommentSelectionCleanup();
                myListCommentSelectionCleanup = null;
            }
            renderMyListsSection(myListId);
        }

        function getMyListCommentStageMetrics() {
            const mainWorkspace = document.querySelector('#workspace .main');
            if (!mainWorkspace) {
                return null;
            }

            const rect = mainWorkspace.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return null;
            }

            return { mainWorkspace, rect };
        }

        function updateMyListCommentSelectionPreview(selection) {
            const preview = document.getElementById('my-list-comment-selection');
            if (!preview || !selection) {
                return;
            }

            preview.classList.remove('hidden');
            preview.style.left = `${selection.x_percent * 100}%`;
            preview.style.top = `${selection.y_percent * 100}%`;
            preview.style.width = `${selection.width_percent * 100}%`;
            preview.style.height = `${selection.height_percent * 100}%`;
        }

        function hideMyListCommentSelectionPreview() {
            const preview = document.getElementById('my-list-comment-selection');
            if (!preview) {
                return;
            }

            preview.classList.add('hidden');
            preview.style.left = '';
            preview.style.top = '';
            preview.style.width = '';
            preview.style.height = '';
        }

        function buildMyListCommentSelection(clientX, clientY, rect) {
            const clampedX = Math.min(Math.max(clientX, rect.left), rect.right);
            const clampedY = Math.min(Math.max(clientY, rect.top), rect.bottom);
            const startX = Math.min(myListCommentSelection.startX, clampedX);
            const endX = Math.max(myListCommentSelection.startX, clampedX);
            const startY = Math.min(myListCommentSelection.startY, clampedY);
            const endY = Math.max(myListCommentSelection.startY, clampedY);

            return {
                x_percent: (startX - rect.left) / rect.width,
                y_percent: (startY - rect.top) / rect.height,
                width_percent: (endX - startX) / rect.width,
                height_percent: (endY - startY) / rect.height,
            };
        }

        function startMyListCommentSelection(event) {
            if (!myListCommentMode || myListCommentDraft) {
                return;
            }

            const metrics = getMyListCommentStageMetrics();
            if (!metrics) {
                return;
            }

            event.preventDefault();
            myListCommentSelection = {
                startX: event.clientX,
                startY: event.clientY,
            };

            const handleMove = (moveEvent) => {
                if (!myListCommentSelection) {
                    return;
                }

                const selection = buildMyListCommentSelection(moveEvent.clientX, moveEvent.clientY, metrics.rect);
                updateMyListCommentSelectionPreview(selection);
            };

            const handleUp = (upEvent) => {
                if (!myListCommentSelection) {
                    return;
                }

                const selection = buildMyListCommentSelection(upEvent.clientX, upEvent.clientY, metrics.rect);
                cleanup();
                myListCommentSelectionCleanup = null;
                hideMyListCommentSelectionPreview();
                myListCommentSelection = null;

                if (selection.width_percent < 0.015 || selection.height_percent < 0.015) {
                    return;
                }

                const normalized = normalizeMyListCommentDimensions(selection.width_percent, selection.height_percent);
                myListCommentMode = false;
                myListCommentDraft = {
                    ...selection,
                    width_percent: normalized.widthPercent,
                    height_percent: normalized.heightPercent,
                    content: '',
                };
                renderMyListsSection(myListId);
            };

            const cleanup = () => {
                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleUp);
            };

            myListCommentSelectionCleanup = () => {
                cleanup();
                hideMyListCommentSelectionPreview();
            };

            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp, { once: true });
        }

        function cancelMyListCommentDraft() {
            myListCommentDraft = null;
            myListCommentMode = false;
            renderMyListsSection(myListId);
        }

        function toggleMyListCommentGuide(commentId) {
            if (collapsedMyListCommentIds.has(commentId)) {
                collapsedMyListCommentIds.delete(commentId);
            } else {
                collapsedMyListCommentIds.add(commentId);
            }
            renderMyListsSection(myListId);
        }

        function handleCollapsedMyListCommentClick(commentId) {
            if (myListCommentSuppressToggleId === commentId) {
                myListCommentSuppressToggleId = null;
                return;
            }

            toggleMyListCommentGuide(commentId);
        }

        async function deleteMyListComment(commentId) {
            const comment = currentMyListComments.find((entry) => entry.id === commentId);
            if (!comment) {
                return;
            }

            if (!confirm('Vrei să ștergi comentariul?')) {
                return;
            }

            updateStatus('Ștergere comentariu...');
            try {
                await makeRequest('DELETE', `/lists/${myListId}/comments/${commentId}`, null, token);
                collapsedMyListCommentIds.delete(commentId);
                await renderMyListsSection(myListId);
                updateStatus('Comentariu șters');
            } catch (error) {
                alert(error.message);
                updateStatus('Eroare la ștergerea comentariului');
            }
        }

        function updateDraggedCommentPreview(commentId, xPercent, yPercent) {
            const note = document.getElementById(`my-list-comment-${commentId}`);
            if (!note) {
                return;
            }

            note.style.left = `${xPercent * 100}%`;
            note.style.top = `${yPercent * 100}%`;
        }

        function clampMyListCommentPosition(xPercent, yPercent, widthPercent, heightPercent) {
            const clampedWidth = Math.max(0.02, Math.min(1, widthPercent));
            const clampedHeight = Math.max(0.02, Math.min(1, heightPercent));

            return {
                x_percent: Math.max(0, Math.min(1 - clampedWidth, xPercent)),
                y_percent: Math.max(0, Math.min(1 - clampedHeight, yPercent)),
            };
        }

        function startDraggingMyListComment(event, commentId) {
            const comment = currentMyListComments.find((entry) => entry.id === commentId);
            if (!comment) {
                return;
            }

            if (event.target.closest('button')) {
                return;
            }

            const metrics = getMyListCommentStageMetrics();
            if (!metrics) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const commentRect = {
                ...normalizeMyListCommentDimensions(comment.width_percent, comment.height_percent),
            };
            const offsetX = (event.clientX - metrics.rect.left) / metrics.rect.width - Number(comment.x_percent || 0);
            const offsetY = (event.clientY - metrics.rect.top) / metrics.rect.height - Number(comment.y_percent || 0);

            myListCommentDrag = {
                commentId,
                widthPercent: commentRect.widthPercent,
                heightPercent: commentRect.heightPercent,
                offsetX,
                offsetY,
                moved: false,
            };

            const handleMove = (moveEvent) => {
                if (!myListCommentDrag) {
                    return;
                }

                const rawX = (moveEvent.clientX - metrics.rect.left) / metrics.rect.width - myListCommentDrag.offsetX;
                const rawY = (moveEvent.clientY - metrics.rect.top) / metrics.rect.height - myListCommentDrag.offsetY;
                const clamped = clampMyListCommentPosition(
                    rawX,
                    rawY,
                    myListCommentDrag.widthPercent,
                    myListCommentDrag.heightPercent,
                );
                if (Math.abs(rawX - Number(comment.x_percent || 0)) > 0.002 || Math.abs(rawY - Number(comment.y_percent || 0)) > 0.002) {
                    myListCommentDrag.moved = true;
                }
                myListCommentDrag.nextX = clamped.x_percent;
                myListCommentDrag.nextY = clamped.y_percent;
                updateDraggedCommentPreview(commentId, clamped.x_percent, clamped.y_percent);
            };

            const handleUp = async () => {
                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleUp);

                if (!myListCommentDrag) {
                    return;
                }

                const { nextX, nextY, moved } = myListCommentDrag;
                myListCommentDrag = null;

                if (moved) {
                    myListCommentSuppressToggleId = commentId;
                    window.setTimeout(() => {
                        if (myListCommentSuppressToggleId === commentId) {
                            myListCommentSuppressToggleId = null;
                        }
                    }, 180);
                }

                if (typeof nextX !== 'number' || typeof nextY !== 'number') {
                    return;
                }

                try {
                    await makeRequest('PATCH', `/lists/${myListId}/comments/${commentId}`, {
                        x_percent: Number(nextX.toFixed(4)),
                        y_percent: Number(nextY.toFixed(4)),
                    }, token);
                    await renderMyListsSection(myListId);
                } catch (error) {
                    alert(error.message);
                    await renderMyListsSection(myListId);
                }
            };

            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp, { once: true });
        }

        async function saveMyListComment() {
            if (!token || !myListId || !myListCommentDraft) {
                return;
            }

            const textarea = document.getElementById('my-list-comment-textarea');
            const content = textarea?.value.trim() || '';
            if (!content) {
                alert('Scrie un comentariu înainte să salvezi.');
                return;
            }

            updateStatus('Salvare comentariu...');
            try {
                await makeRequest('POST', `/lists/${myListId}/comments`, {
                    content,
                    x_percent: Number(myListCommentDraft.x_percent.toFixed(4)),
                    y_percent: Number(myListCommentDraft.y_percent.toFixed(4)),
                    width_percent: Number(myListCommentDraft.width_percent.toFixed(4)),
                    height_percent: Number(myListCommentDraft.height_percent.toFixed(4)),
                }, token);

                myListCommentDraft = null;
                myListCommentMode = false;
                await renderMyListsSection(myListId);
                updateStatus('Comentariu adăugat');
            } catch (error) {
                alert(error.message);
                updateStatus('Eroare la salvarea comentariului');
            }
        }

        function openMembersModal(selectedListId) {
            listId = selectedListId;
            const modal = document.getElementById('members-modal');
            modal.classList.remove('hidden');
            loadListMembersModal();
        }

        function closeMembersModal() {
            const modal = document.getElementById('members-modal');
            modal.classList.add('hidden');
            document.getElementById('members-modal-add-form').classList.add('hidden');
        }

        async function loadListMembersModal() {
            const loadingDiv = document.getElementById('members-modal-loading');
            const listDiv = document.getElementById('members-modal-list');
            const addButton = document.getElementById('members-modal-add-btn');
            const addForm = document.getElementById('members-modal-add-form');
            const selectedList = getAccessibleMyListById(listId);
            const canManageList = canManageCurrentList(selectedList);
            
            if (!listId) {
                listDiv.innerHTML = '<p style="color: red;">Eroare: nicio listă selectată.</p>';
                return;
            }

            addForm.classList.add('hidden');
            addButton.classList.toggle('hidden', !canManageList);

            loadingDiv.classList.remove('hidden');
            listDiv.innerHTML = '';

            try {
                const members = await makeRequest('GET', `/lists/${listId}/members`, null, token);
                currentMembers = Array.isArray(members) ? members : [];
                loadingDiv.classList.add('hidden');
                renderMembersModal(currentMembers);
            } catch (error) {
                loadingDiv.classList.add('hidden');
                listDiv.innerHTML = `<p style="color: red;">Eroare: ${error.message}</p>`;
            }
        }

        function renderMembersModal(members) {
            const container = document.getElementById('members-modal-list');
            const selectedList = getAccessibleMyListById(listId);
            const canManageList = canManageCurrentList(selectedList);
            
            if (!members || members.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #6d7a72;">Nu sunt utilizatori momentan.</p>';
                return;
            }

            container.innerHTML = members
                .map((member) => {
                    const isOwner = member.role === 'owner';
                    return `
                        <div class="member-item">
                            <div class="member-info">
                                <strong>${escapeHtml(member.email || 'Unknown')}</strong>
                                <small>Rol: <strong>${escapeHtml(member.role || 'viewer')}</strong>${isOwner ? ' (Proprietar)' : ''}</small>
                            </div>
                            ${canManageList && !isOwner ? `<button type="button" class="danger-button" onclick="removeMemberModal('${member.user_id || member.id}')">Șterge</button>` : '<span style="color: #6d7a72; font-size: 13px;">Doar proprietarul poate modifica accesul</span>'}
                        </div>
                    `;
                })
                .join('');
        }

        async function removeMemberModal(userId) {
            if (!canManageCurrentList(getAccessibleMyListById(listId))) {
                updateStatus('Doar proprietarul poate elimina membri din listă');
                return;
            }

            if (!confirm('Ești sigur că vrei să elimini acest utilizator?')) {
                return;
            }

            try {
                await makeRequest('DELETE', `/lists/${listId}/members/${userId}`, null, token);
                updateStatus('Utilizator eliminat cu succes!');

                await loadListMembersModal();

                if (myListId === listId) {
                    await renderMyListsSection(myListId);
                }
            } catch (error) {
                alert(`Eroare la eliminarea utilizatorului: ${error.message}`);
            }
        }

        function toggleAddMemberFormModal() {
            const selectedList = getAccessibleMyListById(listId);
            if (!canManageCurrentList(selectedList)) {
                return;
            }

            const form = document.getElementById('members-modal-add-form');
            form.classList.toggle('hidden');
            
            if (!form.classList.contains('hidden')) {
                document.getElementById('modal-share-email').focus();
            }
        }

        async function submitAddMemberModal() {
            if (!canManageCurrentList(getAccessibleMyListById(listId))) {
                updateStatus('Doar proprietarul poate adăuga membri noi');
                return;
            }

            const email = document.getElementById('modal-share-email').value.trim();
            const role = document.getElementById('modal-share-role').value;

            if (!email) {
                alert('Te rog introdu un email.');
                return;
            }

            try {
                await makeRequest('POST', `/lists/${listId}/share`, { user_email: email, role }, token);
                updateStatus('Utilizator adăugat cu succes!');

                document.getElementById('modal-share-email').value = '';
                document.getElementById('modal-share-role').value = 'editor';
                toggleAddMemberFormModal();

                await loadListMembersModal();

                if (myListId === listId) {
                    await renderMyListsSection(myListId);
                }
            } catch (error) {
                alert(`Eroare la adăugarea utilizatorului: ${error.message}`);
            }
        }

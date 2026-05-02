// ==========================================
// MOTEUR MATHÉMATIQUE AHP (VANILLA JS COMPLET)
// ==========================================

const RANDOM_INDEX = { 1: 0.00, 2: 0.00, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };
const CR_THRESHOLD = 0.10;
    const INCONSISTENCY_DEVIATION_THRESHOLD = 0.50;

    function columnSums(M) {
        const n = M.length;
        const sums = Array(n).fill(0);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                sums[j] += M[i][j];
        return sums;
    }

    function normalizeMatrix(M) {
        const sums = columnSums(M);
        return M.map(row => row.map((val, j) => sums[j] === 0 ? 0 : val / sums[j]));
    }

    function priorityVector(normalizedM) {
        const n = normalizedM.length;
        return normalizedM.map(row => row.reduce((acc, v) => acc + v, 0) / n);
    }

    function matrixVectorProduct(M, w) {
        return M.map(row => row.reduce((acc, val, j) => acc + val * w[j], 0));
    }

    function computeLambdaMax(M, w) {
        const n = M.length;
        const Aw = matrixVectorProduct(M, w);
        const lambdas = Aw.map((val, i) => (w[i] === 0 ? 0 : val / w[i]));
        const lambdaMax = lambdas.reduce((acc, v) => acc + v, 0) / n;
        return { lambdaMax, lambdas, Aw };
    }

    function analyzeConsistency(M, w) {
        const n = M.length;
        const { lambdaMax } = computeLambdaMax(M, w);
        const ci = n <= 1 ? 0 : (lambdaMax - n) / (n - 1);
        const ri = RANDOM_INDEX[n] || 0;
        const cr = ri === 0 ? 0 : ci / ri;

        return {
            n,
            lambdaMax,
            CI: ci,
            CR: cr,
            CRpercent: parseFloat((cr * 100).toFixed(2)),
            isConsistent: cr <= CR_THRESHOLD
        };
    }

    function findInconsistencies(M, w, labels = []) {
        const n = M.length;
        const result = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (w[j] === 0 || w[i] === 0) continue;
                const impliedRatio = w[i] / w[j];
                const givenRatio = M[i][j];
                const deviation = Math.max(givenRatio / impliedRatio, impliedRatio / givenRatio) - 1;

                if (deviation > INCONSISTENCY_DEVIATION_THRESHOLD) {
                    result.push({
                        i, j,
                        critereI: labels[i] || `Critère ${i + 1}`,
                        critereJ: labels[j] || `Critère ${j + 1}`,
                        given: parseFloat(givenRatio.toFixed(2)),
                        suggestion: parseFloat(impliedRatio.toFixed(2)),
                        deviation
                    });
                }
            }
        }
        return result.sort((a, b) => b.deviation - a.deviation);
    }

    function analyzePairwiseMatrix(M, labels = []) {
        const normalized = normalizeMatrix(M);
        const w = priorityVector(normalized);
        const consistency = analyzeConsistency(M, w);

        const result = {
            weights: w,
            ...consistency
        };

        if (!consistency.isConsistent) {
            result.inconsistencies = findInconsistencies(M, w, labels);
            result.warning = "Ratio CR > 10%. Veuillez revoir les jugements pour améliorer la logique.";
        }
        return result;
    }

    function propagateWeights(node, matrices, parentWeight, leafResults, consistencyLog) {
        if (node.children.length === 0) {
            leafResults.push({ label: node.label, globalWeight: parentWeight });
            return;
        }

        const M = matrices[node.label];
        if (!M) throw new Error(`Matrice manquante pour: ${node.label}`);

        const normalized = normalizeMatrix(M);
        const localWeights = priorityVector(normalized);
        const labels = node.children.map(c => c.label);
        const consistency = analyzeConsistency(M, localWeights);

        consistencyLog.push({ node: node.label, consistency });

        if (!consistency.isConsistent) return;

        node.children.forEach((child, i) => {
            propagateWeights(child, matrices, localWeights[i] * parentWeight, leafResults, consistencyLog);
        });
    }

    function analyzeMultiLevelAHP(tree, matrices, altNames, altMatrices) {
        const leafResults = [];
        const consistencyLog = [];
        propagateWeights(tree, matrices, 1.0, leafResults, consistencyLog);

        const inconsistentNodes = consistencyLog.filter(log => !log.consistency.isConsistent);
        if (inconsistentNodes.length > 0) return { success: false, error: 'Une matrice est incohérente.' };

        const leafLabels = leafResults.map(l => l.label);
        const leafWeights = leafResults.map(l => l.globalWeight);

        const altLocalWeightsByLeaf = leafLabels.map(label => {
            const M = altMatrices[label];
            const norm = normalizeMatrix(M);
            return priorityVector(norm);
        });

        const finalScores = altNames.map((name, i) => {
            const breakdown = leafLabels.map((label, j) => ({
                leaf: label,
                contribution: leafWeights[j] * altLocalWeightsByLeaf[j][i]
            }));
            const globalScore = breakdown.reduce((acc, b) => acc + b.contribution, 0);
            return { rank: 0, name, globalScore, breakdown };
        });

        finalScores.sort((a, b) => b.globalScore - a.globalScore);
        finalScores.forEach((alt, i) => { alt.rank = i + 1; });

        return { success: true, data: { ranking: finalScores } };
    }


    // ==========================================
    // ETAT ET INTERFACE UTILISATEUR
    // ==========================================

    let currentStep = 1;
    const totalSteps = 8;
    
    function getInitialState() {
        return {
            objective: 'Choisir le meilleur',
            criteria: [{id: generateId(), name: 'Prix', type: 'cost'}, {id: generateId(), name: 'Qualité', type: 'benefit'}],
            subCriteria: {},
            comparisons: {}, 
            consistencyAnalysis: [],
            ignoredWarnings: false,
            alternatives: [{id: generateId(), name: 'Option A'}, {id: generateId(), name: 'Option B'}],
            scores: {}, 
            results: null
        };
    }
    
    let state = getInitialState();

    const sections = Array.from({length: 8}, (_, i) => document.getElementById(`step-${i+1}`));
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    const stepInd = document.getElementById('step-indicator');
    const progressFill = document.getElementById('progress-fill');

    function generateId() { return Math.random().toString(36).substring(2, 9); }
    
    function getLeafCriteria() {
        let leaves = [];
        state.criteria.filter(c => c.name.trim()).forEach(c => {
            const subs = state.subCriteria[c.id]?.filter(s => s.name.trim()) || [];
            if (subs.length > 0) leaves = leaves.concat(subs.map(s => ({...s, type: s.type || c.type})));
            else leaves.push(c);
        });
        return leaves;
    }

    function updateNav() {
        sections.forEach((sec, i) => {
            if(i + 1 === currentStep) sec.classList.add('active');
            else sec.classList.remove('active');
        });
        prevBtn.disabled = currentStep === 1;
        stepInd.textContent = `Étape ${currentStep} / ${totalSteps}`;
        progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
        
        // Validation helpers
        const checkProceed = () => {
            if(currentStep === 1) return state.objective.trim().length > 0;
            if(currentStep === 2) return state.criteria.filter(c => c.name.trim()).length >= 2;
            if(currentStep === 5) return state.ignoredWarnings || state.consistencyAnalysis.every(a => a.isConsistent);
            if(currentStep === 6) return state.alternatives.filter(a => a.name.trim()).length >= 2;
            return true;
        };
        
        if(currentStep === 1) renderStep1();
        else if(currentStep === 2) { renderList('criteria-list', state.criteria, 'Ex: Prix', list => { state.criteria = list; nextBtn.disabled = !checkProceed(); }, true); }
        else if(currentStep === 3) renderSubCriteria();
        else if(currentStep === 4) renderPairwise();
        else if(currentStep === 5) renderConsistency();
        else if(currentStep === 6) { renderList('alternatives-list', state.alternatives, 'Ex: Option 1', list => { state.alternatives = list; nextBtn.disabled = !checkProceed(); }, false); }
        else if(currentStep === 7) renderScores();
        
        if(currentStep !== 8) {
            nextBtn.style.display = 'inline-flex';
            nextBtn.innerHTML = currentStep === 7 ? 'Calculer <span class="icon">→</span>' : 'Continuer <span class="icon">→</span>';
            nextBtn.disabled = !checkProceed();
        } else {
            nextBtn.style.display = 'none';
        }
    }

    prevBtn.addEventListener('click', () => { currentStep = Math.max(1, currentStep - 1); updateNav(); });
    
    nextBtn.addEventListener('click', async () => {
        if(currentStep === 4) await processConsistency();
        if(currentStep === 7) await processResults();
        
        if(currentStep < totalSteps) { currentStep++; updateNav(); }
    });
    
    restartBtn.addEventListener('click', () => {
        state = getInitialState();
        currentStep = 1;
        if(resultChartInst) { resultChartInst.destroy(); resultChartInst = null; }
        updateNav();
    });

    // ---- STEP 1 ----
    const objInput = document.getElementById('objective-input');
    function renderStep1() {
        if(objInput.value !== state.objective) objInput.value = state.objective;
    }
    objInput.addEventListener('input', e => {
        state.objective = e.target.value;
        nextBtn.disabled = state.objective.trim().length === 0;
    });

    // ---- STEP 2 & 6 (Lists) ----
    function renderList(containerId, items, placeholder, onChange, isCriterion = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'list-row animated-item';
            row.style.animationDelay = `${index * 0.05}s`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'list-input';
            input.value = item.name;
            input.placeholder = placeholder;
            input.addEventListener('input', e => {
                items[index].name = e.target.value;
                onChange(items);
            });
            
            row.appendChild(input);

            if (isCriterion) {
                const isCost = items[index].type === 'cost';
                const typeBtn = document.createElement('button');
                typeBtn.className = isCost ? 'btn-red-outline' : 'btn-green-outline';
                typeBtn.innerHTML = isCost ? '📉 Minimiser' : '📈 Maximiser';
                typeBtn.title = 'Changer la direction de l\'optimisation';
                typeBtn.addEventListener('click', () => {
                    items[index].type = isCost ? 'benefit' : 'cost';
                    onChange(items);
                    renderList(containerId, items, placeholder, onChange, isCriterion);
                });
                row.appendChild(typeBtn);
            }

            if(items.length > 2) {
                const btn = document.createElement('button');
                btn.className = 'btn-icon-danger';
                btn.innerHTML = '✖';
                btn.addEventListener('click', () => {
                    onChange(items.filter(x => x.id !== item.id));
                    renderList(containerId, items, placeholder, onChange, isCriterion);
                });
                row.appendChild(btn);
            }
            container.appendChild(row);
        });
    }

    document.getElementById('add-criterion-btn').addEventListener('click', () => {
        state.criteria.push({id: generateId(), name: '', type: 'benefit'});
        renderList('criteria-list', state.criteria, 'Critère', list => { state.criteria = list; nextBtn.disabled = state.criteria.filter(c => c.name.trim()).length < 2; }, true);
        nextBtn.disabled = state.criteria.filter(c => c.name.trim()).length < 2;
    });
    document.getElementById('add-alternative-btn').addEventListener('click', () => {
        state.alternatives.push({id: generateId(), name: ''});
        renderList('alternatives-list', state.alternatives, 'Alternative', list => { state.alternatives = list; nextBtn.disabled = state.alternatives.filter(a => a.name.trim()).length < 2; }, false);
        nextBtn.disabled = state.alternatives.filter(a => a.name.trim()).length < 2;
    });

    // ---- STEP 3 ----
    function renderSubCriteria() {
        const container = document.getElementById('subcriteria-list');
        container.innerHTML = '';
        state.criteria.filter(c => c.name.trim()).forEach((c, idx) => {
            const card = document.createElement('div');
            card.className = 'subcriteria-card animated-item';
            card.style.animationDelay = `${idx * 0.1}s`;
            card.innerHTML = `<h3>${c.name}</h3>`;
            
            const listDiv = document.createElement('div');
            listDiv.className = 'list-container';
            card.appendChild(listDiv);
            
            const subs = state.subCriteria[c.id] || [];
            
            const renderSubs = () => {
                listDiv.innerHTML = '';
                subs.forEach((sub, i) => {
                    const row = document.createElement('div');
                    row.className = 'list-row';
                    const inp = document.createElement('input');
                    inp.type='text'; inp.className='list-input'; inp.value=sub.name; inp.placeholder="Sous-critère...";
                    inp.addEventListener('input', e => { sub.name = e.target.value; });
                    row.appendChild(inp);

                    const isCost = sub.type === 'cost';
                    const typeBtn = document.createElement('button');
                    typeBtn.className = isCost ? 'btn-red-outline' : 'btn-green-outline';
                    typeBtn.innerHTML = isCost ? '📉 Min' : '📈 Max';
                    typeBtn.title = isCost ? "Minimiser ce critère" : "Maximiser ce critère";
                    typeBtn.addEventListener('click', () => {
                        sub.type = isCost ? 'benefit' : 'cost';
                        renderSubs();
                    });
                    row.appendChild(typeBtn);

                    const btn = document.createElement('button');
                    btn.className = 'btn-icon-danger'; btn.innerHTML = '✖';
                    btn.addEventListener('click', () => { subs.splice(i, 1); renderSubs(); });
                    row.appendChild(btn);
                    listDiv.appendChild(row);
                });
            };
            renderSubs();
            
            const addBtn = document.createElement('button');
            addBtn.className = 'btn-dashed w-full';
            addBtn.innerHTML = '+ Ajouter';
            addBtn.addEventListener('click', () => {
                if(!state.subCriteria[c.id]) state.subCriteria[c.id] = [];
                state.subCriteria[c.id].push({id: generateId(), name: '', type: c.type});
                renderSubs();
            });
            card.appendChild(addBtn);
            container.appendChild(card);
        });
    }

    // ---- STEP 4: Pairwise ----
    const SAATY_SCALE_LABELS = {
        1: 'ÉGAL', 2: 'FAIBLE', 3: 'LÉGER', 4: 'MODÉRÉ', 5: 'FORT', 6: 'TRÈS FORT', 7: 'EXCELLENT', 8: 'EXTRÊME', 9: 'ABSOLU'
    };
    function getPairwiseTasks() {
        const tasks = [];
        const validC = state.criteria.filter(c => c.name.trim());
        if(validC.length > 1) {
            tasks.push({ parentId: 'root', parentName: state.objective, items: validC });
        }
        validC.forEach(c => {
            const subs = state.subCriteria[c.id]?.filter(s => s.name.trim()) || [];
            if(subs.length > 1) {
                tasks.push({ parentId: c.id, parentName: c.name, items: subs });
            }
        });
        return tasks;
    }
    
    function renderPairwise() {
        const container = document.getElementById('pairwise-list');
        container.innerHTML = '';
        const tasks = getPairwiseTasks();
        tasks.forEach((task, idx) => {
            const group = document.createElement('div');
            group.className = 'pairwise-group animated-item';
            group.style.animationDelay = `${idx * 0.1}s`;
            group.innerHTML = `<h3>${task.parentName}</h3>`;
            
            for(let i=0; i < task.items.length; i++) {
                for(let j=i+1; j < task.items.length; j++) {
                    const pairContainer = document.createElement('div');
                    pairContainer.className = 'comparison-item';
                    const key = `${i}-${j}`;
                    const val = state.comparisons[task.parentId]?.[key] || 0;
                    
                    pairContainer.innerHTML = `
                        <div class="compare-labels">
                            <span class="lbl-a ${val < 0 ? 'active-side' : 'inactive-side'}">${task.items[i].name}</span>
                            <div class="saaty-indicator" id="ind-${task.parentId}-${key}">...</div>
                            <span class="lbl-b ${val > 0 ? 'active-side' : 'inactive-side'}">${task.items[j].name}</span>
                        </div>
                        <div class="range-wrapper">
                            <div class="range-center-mark"></div>
                            <input type="range" min="-8" max="8" step="1" id="rng-${task.parentId}-${key}" value="${val}">
                        </div>
                        <div class="range-ticks">
                            <span>9</span><span>7</span><span>5</span><span>3</span><span>1</span><span>3</span><span>5</span><span>7</span><span>9</span>
                        </div>
                    `;
                    group.appendChild(pairContainer);
                    
                    setTimeout(() => {
                        const input = document.getElementById(`rng-${task.parentId}-${key}`);
                        const ind = document.getElementById(`ind-${task.parentId}-${key}`);
                        const lblA = input.parentElement.previousElementSibling.children[0];
                        const lblB = input.parentElement.previousElementSibling.children[2];
                        
                        const updateUI = (v) => {
                            if(!state.comparisons[task.parentId]) state.comparisons[task.parentId] = {};
                            state.comparisons[task.parentId][key] = parseInt(v);
                            state.ignoredWarnings = false;
                            
                            const abs = Math.abs(v) + 1;
                            ind.innerHTML = `${SAATY_SCALE_LABELS[abs] || '...'} <br><span style="font-size:12px">(${abs})</span>`;
                            
                            ind.className = 'saaty-indicator ' + (v == 0 ? 'ind-0' : abs <= 3 ? 'ind-low' : abs <= 6 ? 'ind-mid' : 'ind-high');
                            lblA.className = 'lbl-a ' + (v < 0 ? 'active-side' : 'inactive-side');
                            lblB.className = 'lbl-b ' + (v > 0 ? 'active-side' : 'inactive-side');
                        };
                        updateUI(val);
                        input.addEventListener('input', e => updateUI(e.target.value));
                    }, 0);
                }
            }
            container.appendChild(group);
        });
    }

    // ---- STEP 5: Consistency ----
    async function processConsistency() {
        state.consistencyAnalysis = [];
        const tasks = getPairwiseTasks();
        
        for (const task of tasks) {
            const matrix = buildMatrix(task.items.length, state.comparisons[task.parentId]);
            const result = analyzePairwiseMatrix(matrix, task.items.map(x => x.name));
            state.consistencyAnalysis.push({ parentId: task.parentId, name: task.parentName, ...result });
        }
    }

    function renderConsistency() {
        const container = document.getElementById('consistency-list');
        container.innerHTML = '';
        
        let allCons = true;
        state.consistencyAnalysis.forEach(anal => {
            if(!anal.isConsistent) allCons = false;
            
            const card = document.createElement('div');
            card.className = `cons-card ${anal.isConsistent ? 'success' : 'error'}`;
            
            let inconsHtml = '';
            if(!anal.isConsistent && anal.inconsistencies?.length) {
                const listItems = anal.inconsistencies.slice(0, 2).map(inc => {
                    const formatRatio = (val) => val < 1 ? '1/' + Math.round(1/val) : Math.round(val);
                    return '<li><strong>' + inc.critereI + ' vs ' + inc.critereJ + '</strong> : rapport actuel de <strong>' + formatRatio(inc.given) + '</strong>, la cohérence mathématique suggère de se rapprocher de <strong>' + formatRatio(inc.suggestion) + '</strong>.</li>';
                }).join('');
                
                inconsHtml = `
                <div class="cons-details">
                    <p>⚠️ ${anal.warning}</p>
                    <ul>
                        ${listItems}
                    </ul>
                </div>`;
            }

            card.innerHTML = `
                <div class="cons-header">
                    <h3>${anal.name}</h3>
                    <div class="cons-badge ${anal.isConsistent ? 'success' : 'error'}">
                        ${anal.isConsistent ? '✓' : '!'} CR: ${anal.CRpercent}%
                    </div>
                </div>
                ${inconsHtml}
            `;
            container.appendChild(card);
        });

        const actions = document.getElementById('consistency-actions');
        if(allCons) {
            actions.style.display = 'none';
            container.innerHTML += `<div class="all-consistent-msg">Toutes vos comparaisons sont cohérentes ! 🎉</div>`;
            nextBtn.disabled = false;
        } else {
            actions.style.display = 'flex';
            nextBtn.disabled = !state.ignoredWarnings;
        }
    }

    // Consistency Actions
    document.getElementById('fix-manually-btn').addEventListener('click', () => { currentStep = 4; updateNav(); });
    document.getElementById('ignore-warning-btn').addEventListener('click', () => { state.ignoredWarnings = true; currentStep = 6; updateNav(); });
    document.getElementById('auto-fix-btn').addEventListener('click', () => {
        state.consistencyAnalysis.forEach(res => {
            if (!res.isConsistent && res.inconsistencies?.length > 0) {
                let taskComps = state.comparisons[res.parentId] || {};
                res.inconsistencies.forEach(inc => {
                    const task = getPairwiseTasks().find(t => t.parentId === res.parentId);
                    if(task) {
                        const { i, j, suggestion: ratio } = inc;
                        let val = ratio >= 1 ? -(ratio - 1) : ((1 / ratio) - 1);
                        val = Math.round(val);
                        val = Math.max(-8, Math.min(8, val));
                        taskComps[`${i}-${j}`] = val;
                    }
                });
                state.comparisons[res.parentId] = taskComps;
            }
        });
        state.ignoredWarnings = false;
        processConsistency().then(() => renderConsistency());
    });
    
    // ---- STEP 7: Scores ----
    function renderScores() {
        const thead = document.getElementById('scores-thead-tr');
        const tbody = document.getElementById('scores-tbody');
        thead.innerHTML = '<th>Alternative</th>';
        tbody.innerHTML = '';
        const leaves = getLeafCriteria();
        
        leaves.forEach(l => {
            const th = document.createElement('th');
            th.textContent = l.name;
            thead.appendChild(th);
        });
        
        state.alternatives.filter(a => a.name.trim()).forEach((alt, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${alt.name}</td>`;
            leaves.forEach(l => {
                const td = document.createElement('td');
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.className = 'score-input';
                inp.placeholder = '0';
                inp.value = state.scores[l.id]?.[alt.id] ?? '';
                inp.addEventListener('input', e => {
                    if(!state.scores[l.id]) state.scores[l.id] = {};
                    state.scores[l.id][alt.id] = parseFloat(e.target.value) || 0;
                });
                td.appendChild(inp);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    // ---- MATRIX BUILDER ----
    function buildMatrix(n, comps = {}) {
        const matrix = Array(n).fill(0).map(() => Array(n).fill(1));
        for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const val = comps[`${i}-${j}`] || 0;
            const ratio = val < 0 ? (-val + 1) : 1 / (val + 1);
            matrix[i][j] = ratio;
            matrix[j][i] = 1 / ratio;
        }
        }
        return matrix;
    }
    
    function buildAltMatrix(rawScoresMap, alts, n, isCost = false) {
        const matrix = Array(n).fill(0).map(() => Array(n).fill(1));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const vi = Math.max(0.0001, rawScoresMap[alts[i].id] || 0);
                const vj = Math.max(0.0001, rawScoresMap[alts[j].id] || 0);
                const ratio = isCost ? (vj / vi) : (vi / vj);
                matrix[i][j] = ratio;
                matrix[j][i] = 1 / ratio;
            }
        }
        return matrix;
    }

    // ---- STEP 8: Results ----
    async function processResults() {
        const validC = state.criteria.filter(c => c.name.trim());
        const tree = { label: state.objective, children: [] };
        
        validC.forEach(c => {
            const subs = state.subCriteria[c.id]?.filter(s => s.name.trim()) || [];
            tree.children.push({
                label: c.name,
                children: subs.map(s => ({ label: s.name, children: [] }))
            });
        });

        const matrices = {};
        matrices[state.objective] = buildMatrix(validC.length, state.comparisons['root']);
        validC.forEach(c => {
            const subs = state.subCriteria[c.id]?.filter(s => s.name.trim()) || [];
            if(subs.length > 0) matrices[c.name] = buildMatrix(subs.length, state.comparisons[c.id]);
        });

        const alts = state.alternatives.filter(a => a.name.trim());
        const altNames = alts.map(a => a.name);
        const altMatrices = {};
        const leaves = getLeafCriteria();
        leaves.forEach(l => {
            altMatrices[l.name] = buildAltMatrix(state.scores[l.id] || {}, alts, alts.length, l.type === 'cost');
        });

        const result = analyzeMultiLevelAHP(tree, matrices, altNames, altMatrices);
        
        if (result.success) {
            state.results = result.data;
            renderResults();
        } else {
            console.error(result.error);
        }
    }

    let resultChartInst = null;
    function renderResults() {
        const container = document.getElementById('ranking-list');
        container.innerHTML = '';
        state.results.ranking.forEach((alt, idx) => {
            const card = document.createElement('div');
            card.className = `rank-card ${alt.rank === 1 ? 'rank-1' : ''} animated-item`;
            card.style.animationDelay = `${idx * 0.1}s`;
            
            const breakHtml = (alt.breakdown || []).map(b => `<div class="detail-chip">${b.leaf}: <strong>${(b.contribution * 100).toFixed(1)}</strong></div>`).join('');

            card.innerHTML = `
                <div class="rank-header">
                    <div class="rank-info">
                        <div class="rank-badge">#${alt.rank}</div>
                        <div class="rank-name">${alt.name}</div>
                    </div>
                    <div class="rank-score">${(alt.globalScore * 100).toFixed(1)}<span>/100</span></div>
                </div>
                ${breakHtml ? `<div class="rank-details">${breakHtml}</div>` : ''}
            `;
            container.appendChild(card);
        });

        // Chart
        const ctx = document.getElementById('resultsChart').getContext('2d');
        if(resultChartInst) resultChartInst.destroy();
        
        const isDark = document.body.dataset.theme === 'dark';
        const gridColor = isDark ? '#334155' : '#f1f5f9';
        const textColor = isDark ? '#cbd5e1' : '#64748b';
        
        resultChartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: state.results.ranking.map(r => r.name),
                datasets: [{
                    label: 'Score Global (%)',
                    data: state.results.ranking.map(r => r.globalScore * 100),
                    backgroundColor: state.results.ranking.map(r => r.rank === 1 ? '#10b981' : (isDark ? '#475569' : '#94a3b8')),
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 100, 
                        border: {display: false}, 
                        grid: {color: gridColor},
                        ticks: { color: textColor }
                    },
                    x: { 
                        border: {display: false}, 
                        grid: {display: false},
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }

// Theme Toggle Logic
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.body.dataset.theme === 'dark';
        document.body.dataset.theme = isDark ? '' : 'dark';
        themeBtn.textContent = isDark ? '🌙' : '☀️';
        if (resultChartInst) {
            renderResults();
        }
    });
}

// Init display
updateNav();

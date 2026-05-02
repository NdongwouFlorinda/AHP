# AHP Engine - Outil Décisionnel Multicritères

**AHP Engine** est une application web interactive basée sur l'**Analytic Hierarchy Process (AHP)**, une méthode mathématique rigoureuse de prise de décision multicritères développée par Thomas L. Saaty.

Cet outil vous permet de structurer un problème complexe, d'évaluer l'importance de différents critères, de vérifier la cohérence de vos jugements et d'obtenir un classement objectif de vos alternatives.

**Lien de l'application :** [AHP Engine En Ligne](https://ais-pre-qowxp3qoyxiyx6utvlciim-412359955861.europe-west2.run.app)

---

## 📑 Table des Matières

1. [Fonctionnalités Principales](#fonctionnalités-principales)
2. [Guide d'Utilisation (Étape par Étape)](#guide-dutilisation-étape-par-étape)
3. [Technologies Utilisées](#technologies-utilisées)
4. [Structure du Code et Architecture](#structure-du-code-et-architecture)
5. [Comprendre les Mathématiques (Moteur AHP)](#comprendre-les-mathématiques-moteur-ahp)

---

## Fonctionnalités Principales

- **Décomposition Hiérarchique** : Création d'un objectif, définition de critères, et ajout optionnel de sous-critères (AHP multi-niveaux).
- **Gestion des Types de Critères** : Permet de spécifier si un critère est un **Coût** (à minimiser, ex: prix) ou un **Bénéfice** (à maximiser, ex: qualité).
- **Comparaisons par Paires Intuitives** : Utilisation de curseurs (sliders) dynamiques pour évaluer l'importance relative selon l'échelle classique de Saaty (de 1 à 9).
- **Analyse de Cohérence Intelligente (Ratio de Cohérence - CR)** :
  - Calcule automatiquement le Ratio de Cohérence.
  - Détecte l'incohérence logique dans les jugements (lorsque CR > 10%).
  - Propose des **suggestions de corrections mathématiques** pour rééquilibrer la matrice.
  - Option *"Auto-Fix"* pour ajuster automatiquement les valeurs selon l'algorithme AHP.
- **Saisie des Données Quantitatives** : Évaluation des alternatives face à chaque critère de base.
- **Résultats et Tableaux de Bord** : 
  - Affichage clair du classement (Ranking) final.
  - Détail graphique interactif (grâce à Chart.js) de la contribution de chaque critère à la note de chaque alternative.

---

## Guide d'Utilisation (Étape par Étape)

Le processus de décision est divisé en **8 étapes interactives** :

1. **Objectif** : Quelle est la décision à prendre ? (ex. "Recruter le meilleur candidat", "Choisir un logiciel").
2. **Critères** : Définissez les axes principaux d'évaluation. Définissez également pour chaque critère s'il s'agit d'un critère à **Maximiser** ou à **Minimiser**.
3. **Sous-critères (Optionnel)** : Apportez de la granularité en subdivisant un critère père (ex. Le critère *Expérience* peut avoir comme sous-critères *Technique* et *Management*).
4. **Comparaisons (Pondération)** : Évaluez chaque paire de critères (et sous-critères) l'un par rapport à l'autre pour déterminer leurs *"poids"*.
5. **Cohérence** : L'algorithme valide la logique de vos choix de l'étape précédente. Si l'alerte de cohérence s'affiche, vous pouvez ajuster manuellement ou appliquer nos suggestions (auto-fix).
6. **Alternatives** : Listez les options finales possibles (ex. "Logiciel A", "Logiciel B", "Logiciel C").
7. **Évaluation par Critère** : Entrez la performance brute (ou le score) de chaque alternative pour chaque critère de "feuille" (le niveau le plus bas). L'outil convertit intelligemment ces valeurs brutes en ratios relatifs en fonction s'il s'agit d'un bénéfice ou d'un coût.
8. **Résultats** : Consultez le classement global, les scores finaux et visualisez la décomposition du score par critère dans le graphique final.

---

## Technologies Utilisées

Ce projet est conçu de manière légère et performante en utilisant les technologies standards du web sans framework majeur (Vanilla).

- **HTML5** : Structure sémantique et claire.
- **CSS3 / Variables CSS** : Design "glassmorphism", moderne, responsive, épuré, centré sur l'expérience utilisateur (UX/UI).
- **JavaScript (ES6+) Vanilla** : Toute l'application, l'état (State Management) et le moteur de calcul matriciel fonctionnent directement dans le navigateur.
- **Chart.js** : Librairie importée via CDN pour le tracé graphique empilé des résultats en étape finale.

---

## Structure du Code et Architecture

L'application est découpée intelligemment entre la logique d'interface et la logique métier.

```text
├── index.html   # Structure de l'application et les 8 sections (étapes)
├── style.css    # Système de design, styles des curseurs, cartes et animations
└── app.js       # Moteur mathématique AHP et gestion globale de l'UI
```

### Le fichier `app.js` est divisé en deux grandes parties :

1. **LE MOTEUR MATHÉMATIQUE AHP (Lignes 1 à 150~)**
   - Fonctions d'algèbre linéaire (`normalizeMatrix`, `columnSums`, `matrixVectorProduct`).
   - Algorithmes de valeurs propres (`computeLambdaMax` pour calculer $\lambda_{max}$).
   - Fonctions de contrôle et analyse AHP (`analyzeConsistency`, `findInconsistencies`, `analyzeMultiLevelAHP`).
2. **ÉTAT (STATE) ET UI (Lignes 150+ à la fin)**
   - Un objet `state` qui conserve l'évolution des données de l'utilisateur (critères, comparaisons, alternatives, scores).
   - Gestion de la navigation entre les étapes (`updateNav()`).
   - Un système de "rendu" manuel par étape (fonctions commençant par `render...` comme `renderPairwise()`, `renderScores()`, `renderDashboard()`).

---

## Comprendre les Mathématiques (Moteur AHP)

L'application n'utilise pas de librairie tierce pour l'algèbre ; tout est codé *"From Scratch"*. Voici les principes de l'AHP respectés :

1. **Matrice de Comparaison** : C'est une matrice réciproque carrée positive $A$ où $a_{ij} = 1 / a_{ji}$.
2. **Vecteur de Priorité** : Obtenu par la normalisation des colonnes de $A$ et par le calcul de la moyenne de chaque ligne.
3. **Ratio de Cohérence (CR)** :
   - On calcule la plus grande valeur propre $\lambda_{max}$.
   - Indice de Cohérence $CI = (\lambda_{max} - n) / (n - 1)$.
   - Ratio $CR = CI / RI$ (où $RI$ est l'Indice Aléatoire, un standard dépendant de $n$).
   - *Si CR > 0.10 (10%)*, l'application considère la matrice comme incohérente.
4. **Correction Intuitive** : L'outil calcule l'écart direct entre le "ratio théorique idéal" d'AHP et le ratio appliqué par l'utilisateur. Si cet écart dépasse $50\%$ (`INCONSISTENCY_DEVIATION_THRESHOLD`), il est ciblé comme racine de l'incohérence.
5. **Critères Coût / Bénéfice dans les scores** : 
   - Pour un **Bénéfice**, s'il y a plus de performance, c'est mieux ($Alternative_A / Alternative_B$).
   - Pour un **Coût**, s'il y a plus de coût, c'est pire. Le ratio matriciel en étape d'évaluation est automatiquement inversé ($Alternative_B / Alternative_A$).

---
<div align="center">
  <i>Développé pour simplifier les prises de décisions complexes grâce aux mathématiques.</i>
</div>

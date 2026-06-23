export const NIVEAUX = [
  { value: 'secondaire_inf', label: 'Secondaire inférieur — S1-S3 (12–15 ans)' },
  { value: 'secondaire_2',   label: '2e degré — S4-S5 (15–17 ans)' },
  { value: 'secondaire_3',   label: '3e degré — S6 (17–18 ans)' },
]

export const TYPES_ENSEIGNEMENT = [
  { value: 'general',        label: 'Général' },
  { value: 'technique',      label: 'Technique de transition' },
  { value: 'technique_qual', label: 'Technique de qualification' },
  { value: 'qualifiant',     label: 'Qualifiant / professionnel' },
  { value: 'cefa',           label: 'CEFA' },
]

export const PROFILS = [
  {
    value: 'dyscalculie',
    label: 'Dyscalculie',
    icon: '🔢',
    strategies_cles: ['Grille de calcul', 'Décomposition procédurale', 'Calculatrice autorisée', 'Couleurs par opération'],
  },
  {
    value: 'dyslexie',
    label: 'Dyslexie / Dysorthographie',
    icon: '📖',
    strategies_cles: ['Consignes épurées', 'Police 14pt AR', 'Problèmes courts', 'Lecture à voix haute'],
  },
  {
    value: 'dyspraxie',
    label: 'Dyspraxie / Trouble DCD',
    icon: '✏️',
    strategies_cles: ['Éviter la copie', 'Outil numérique', 'Espace de travail structuré', 'Délai supplémentaire'],
  },
  {
    value: 'tdah',
    label: 'TDAH',
    icon: '⚡',
    strategies_cles: ['Fiche par étape séparée', 'Minuteur visible', 'Une tâche à la fois', 'Place privilégiée'],
  },
  {
    value: 'allophone',
    label: 'Allophone',
    icon: '🌍',
    strategies_cles: ['Lexique mathématique illustré', 'Symboles universels mis en avant', 'Consignes reformulées', 'Temps supplémentaire'],
  },
  {
    value: 'decrocheur',
    label: 'Décrocheur / désengagé',
    icon: '🔗',
    strategies_cles: ['Ancrage dans le vécu', 'Statistiques/finances réelles', 'Tâche courte avec résultat visible', 'Valorisation des acquis'],
  },
  {
    value: 'hpi',
    label: 'HPI / Haut potentiel',
    icon: '🌟',
    strategies_cles: ['Généralisation', 'Démonstration formelle', 'Problème ouvert', 'Rôle de tuteur'],
  },
]

# 🔮 Déployer sur Vercel

## Option A — Par glisser-déposer (le plus simple, MAIS sans MongoDB)
Le glisser-déposer sur vercel.com ne déploie PAS les fonctions API.
L'app marchera (tirages, IA avec ta clé) mais pas la synchronisation MongoDB.

## Option B — Avec la commande (app complète + MongoDB) ✦ RECOMMANDÉ
1. Installe Node.js (nodejs.org) si ce n'est pas fait
2. Ouvre un terminal DANS ce dossier (vercel-tarot)
3. Tape ces commandes une par une :

   npm install -g vercel
   npm install
   vercel --prod

4. La première fois, Vercel te demande de te connecter (email) et 2-3 questions :
   réponds simplement Entrée à chaque fois (valeurs par défaut).
5. À la fin, il t'affiche ton adresse : https://ton-projet.vercel.app

## Vérifier que l'API fonctionne
Ouvre : https://ton-projet.vercel.app/api/db/test
✓ Si tu vois {"ok":false,"error":"Pas d'URI"} → l'API marche !
✗ Si tu vois une page d'erreur 404 → les fonctions ne sont pas déployées (utilise l'option B)

## MongoDB (dans l'app)
Paramètres → Base de données : colle ton URI MongoDB Atlas.
⚠ Rappels : dans Atlas, mets Network Access sur 0.0.0.0/0,
et CHANGE ton mot de passe MongoDB (tu l'avais partagé en clair).

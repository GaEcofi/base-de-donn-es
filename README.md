# Base de données GaEcofi

Application de gestion de contacts, de demandes de rendez-vous et de suivi des échanges.

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```sh
npm install
npm start
```

Ouvrir `http://localhost:3000`. Au premier démarrage, un mot de passe temporaire pour l’espace privé est affiché dans le terminal. Il change au redémarrage tant que `ADMIN_PASSWORD` n’est pas défini.

## Formulaires publics

Partager `http://localhost:3000/contact`. Après la première étape, la personne est dirigée vers son formulaire de demande de rendez-vous. En production, remplacer cette adresse locale par l’URL publique de l’application.

## Notifications e-mail

Les demandes sont enregistrées même si la messagerie n’est pas configurée. Pour envoyer la notification à `lety.cabaret@gmail.com`, créer un fichier `.env` à partir de `.env.example`, définir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM`, puis renseigner une valeur unique et robuste dans `ADMIN_PASSWORD` et `SESSION_SECRET`. L’e-mail propose un lien de réponse prérempli pour chacun des créneaux.

`APP_URL` doit correspondre à l’adresse de déploiement. En production, les secrets `ADMIN_PASSWORD` et `SESSION_SECRET` sont obligatoires et le cookie de session est sécurisé pour HTTPS.

### Avec Gmail

1. Dans le compte Google expéditeur, activer la validation en deux étapes, puis créer un mot de passe d’application depuis la rubrique « Mots de passe des applications ».
2. Dans le fichier local `.env`, renseigner `SMTP_USER` avec l’adresse Gmail complète, `SMTP_PASS` avec ce mot de passe d’application (pas le mot de passe habituel du compte) et `SMTP_FROM` avec la même adresse. Ne pas mettre ces valeurs dans `.env.example` ni les envoyer dans une conversation.
3. Choisir un mot de passe privé pour `ADMIN_PASSWORD`. Pour générer `SESSION_SECRET` dans un terminal local : `openssl rand -hex 32`.
4. Redémarrer le serveur. Faire un envoi de test et vérifier la boîte de réception ainsi que les courriers indésirables.

Si Google ne propose pas les mots de passe d’application, le compte peut être soumis à une politique qui les désactive ; il faudra alors utiliser un service SMTP autorisé par ce compte.

## Données

Les contacts, demandes et événements sont conservés dans `data/gaecofi.sqlite` (SQLite). Ce fichier est exclu de Git : prévoir sa sauvegarde et un stockage persistant lors du déploiement. L’espace de gestion est protégé par mot de passe ; les formulaires de contact et de rendez-vous sont publics.

L’espace privé est conçu pour une instance du serveur. La configuration e-mail et l’exposition du formulaire au public dépendent du déploiement choisi.

## Déployer sur Render

Le fichier `render.yaml` configure un service web Node avec un disque persistant de 1 Go monté dans `/var/data`. SQLite y sera créé sous `/var/data/gaecofi.sqlite`, ce qui le conserve au redémarrage et lors des nouveaux déploiements. Le disque persistant Render requiert un service payant.

1. Pousser le dépôt sur GitHub et, dans Render, créer un nouveau **Blueprint** relié à ce dépôt. Render détectera `render.yaml` et proposera le service `gaecofi-crm`.
2. Dans le tableau de bord Render, définir `ADMIN_PASSWORD`, `SMTP_USER` et `SMTP_PASS`. Utiliser le mot de passe d’application Gmail pour `SMTP_PASS`. `SESSION_SECRET` est généré automatiquement par Render ; ne pas copier les secrets dans le dépôt.
3. Une fois le déploiement terminé, utiliser l’URL Render du service ; `/contact` est le formulaire public. L’adresse publique est détectée automatiquement par le serveur.

Le volume Render démarre vide : la base SQLite locale `data/gaecofi.sqlite` n’est pas copiée automatiquement. Si des contacts ou demandes existants doivent être conservés, les migrer vers le volume avant d’utiliser le CRM en production. Prévoir aussi une sauvegarde régulière du volume.

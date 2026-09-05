# AI Reflection Journal

A secure, authenticated AI journaling application built with Next.js, Firebase Authentication, Cloud Firestore, and the Gemini API.

## Features

- **Google Sign-In**: Passwordless, secure authentication via Firebase.
- **Private Journaling**: Your entries and reflections are strictly isolated using owner-bound Firestore security rules.
- **AI Reflections**: Gemini provides empathetic summaries, brainstorming ideas, and reflections on your thoughts.
- **Secure Fallback Ladder**: The Gemini API integration features a resilient model fallback mechanism to ensure high availability.

## Prerequisites

- Node.js 20+
- A Google Cloud Project with the following APIs enabled:
  - Cloud Run API
  - Secret Manager API
  - Firestore API
- Google Cloud CLI (`gcloud`) installed and configured.

## Configuration & Deployment

### 1. Firestore Security Configuration

Ensure your Firestore database is deployed in Native mode. Navigate to the Firebase Console and update your Security Rules to guarantee user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 2. Secret Management Setup

Create a Secret Manager secret for your Gemini API key and grant access to the Cloud Run service account.

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
# Replace YOUR_PROJECT_NUMBER with your actual Google Cloud project number.
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Cloud Run Deployment

Deploy your container to Google Cloud Run using the `gcloud` CLI. Ensure you map the Secret Manager secret to the container's environment variables.

```bash
gcloud run deploy ai-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### 4. Required Campaign Labeling

Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update ai-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

## Security Posture

This application implements several defenses based on the OWASP Top 10 for LLMs:
- **Input Validation**: Null-safe destructuring on all API payload ingestion points.
- **Role-Based Access Control**: Hardened Firestore rules prevent cross-user data leaks.
- **No Hardcoded Secrets**: All sensitive API keys and credentials are provided dynamically via Cloud Secret Manager or environment variables.
- **Resilient AI Execution**: Error recovery matrix with automated fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).

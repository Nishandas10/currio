## Firestore rules (required for user profile docs)

If you're seeing **"Missing or insufficient permissions"** when creating `users/{uid}`, update your Firestore Security Rules.

Minimal safe rules for the `users` collection:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Users can read and write ONLY their own profile doc.
      allow read, create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
  }
}
```

Notes:

- These rules assume you're using Firebase Authentication.
- If you have other collections, add their matches alongside this.

Firestore Root
├── users (collection) // User profiles + quick course list
│ └── {userId} (document) // e.g., Firebase Auth UID
│ ├── displayName: string
│ ├── email: string
│ ├── avatarUrl: string // Optional: From Storage
│ ├── createdAt: timestamp
│ ├── courses: array<string> // Denormalized: [courseId1, courseId2] for O(1) user course fetch
│ └── stats: object // Optional: { coursesCreated: number, totalViews: number } (update via Function)
│
├── courses (collection) // All public courses - flat for easy queries
│ └── {courseId} (document) // UUID (e.g., via uuid lib) or auto-ID
│ ├── userId: string // Owner ref (indexed for user queries)
│ ├── title: string // e.g., "React Mastery"
│ ├── slug: string // URL-friendly: e.g., "react-mastery-{shortId}" (gen via slugify)
│ ├── description: string // 1-2 sentence summary (for listings)
│ ├── tags: array<string> // e.g., ['react', 'js', 'beginner'] (max 10; indexed)
│ ├── isPublic: boolean // Default: true
│ ├── podcastStatus: string // 'pending' | 'generating' | 'complete' | 'error' (for UI loading)
│ ├── content: object // Inline JSON for fast full-course reads
│ │ ├── lessons: array<object> // Chapters (5-20 max)
│ │ │ └── {lessonId: number} // Sequential: 1,2,3...
│ │ │ ├── title: string
│ │ │ ├── body: string // Markdown/HTML text (keep <10KB/lesson)
│ │ │ ├── audioUrl: string // gs:// Storage path or public URL
│ │ │ ├── duration: number // Seconds (from TTS)
│ │ │ ├── generatedAt: timestamp // For audio freshness
│ │ │ └── type: string // Optional: 'text' | 'quiz' | 'video'
│ │ └── metadata: object // Course-level: { totalDuration: number, level: 'beginner' }
│ ├── views: number // Increment via Function on read (throttled)
│ ├── createdAt: timestamp // Indexed for sorting
│ └── updatedAt: timestamp // Auto-update on changes
│

<!-- LATER -->

└── progress (collection) // User-specific: Only created on interaction
└── {progressId} (document) // Composite: {userId}\_{courseId}
├── userId: string
├── courseId: string
├── completedLessons: array<number> // e.g., [1,3] for partial progress
├── lastAccessed: timestamp
└── percentComplete: number // Derived: (completed / total) \* 100 (update via Function)

rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {
// Users: Own reads/writes
match /users/{userId} {
allow read, write: if request.auth != null && request.auth.uid == userId;
}

    // Courses: Public reads; owner writes
    match /courses/{courseId} {
      allow read: if resource.data.isPublic == true ||
                     (request.auth != null && resource.data.userId == request.auth.uid);

      allow create: if request.auth != null
                      && request.resource.data.userId == request.auth.uid
                      && request.resource.data.isPublic == true
                      && request.resource.data.content.lessons.size() <= 20;  // Prevent abuse

      allow update: if request.auth != null
                      && resource.data.userId == request.auth.uid
                      && request.resource.data.keys().hasAll(['userId', 'isPublic']);  // Immutable fields
    }

    // Progress: User-only
    match /progress/{progressId} {
      allow read, write: if request.auth != null &&
                           progressId.split('_')[0] == request.auth.uid;
    }

}
}

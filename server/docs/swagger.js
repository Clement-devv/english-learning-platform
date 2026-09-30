// server/docs/swagger.js
// Full OpenAPI 3.0 spec for the English Learning Platform API.
// Served at GET /api/docs (Swagger UI) and GET /api/docs.json (raw spec).

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "English Learning Platform API",
    version: "2.0.0",
    description: `
## Multi-Tenant English Learning Platform

Each center (school) has its own isolated database. All center routes require the \`x-center-slug\` header to identify which center the request belongs to.

### Authentication
Most endpoints require a **Bearer token** obtained from a login endpoint.

### Headers Required for Center Routes
| Header | Example | Description |
|--------|---------|-------------|
| \`Authorization\` | \`Bearer eyJ...\` | JWT from login |
| \`x-center-slug\` | \`my-school\` | Identifies the center |

### Response Format
All responses follow a consistent shape:
\`\`\`json
// Success
{ "success": true, "data": ..., "message": "..." }

// Error
{ "success": false, "message": "Descriptive error" }
\`\`\`
    `,
    contact: {
      name: "Platform Support",
      email: "speak2clem@gmail.com",
    },
  },
  servers: [
    {
      url: "http://localhost:5000/api/v1",
      description: "Local development",
    },
    {
      url: "https://app.clemify.com/api/v1",
      description: "Production",
    },
  ],
  tags: [
    { name: "Auth", description: "Login, logout, password reset, session management" },
    { name: "Teachers", description: "Teacher CRUD, profile, invite, zoom/meet links" },
    { name: "Students", description: "Student CRUD, credits, payments, invite" },
    { name: "Bookings", description: "Class scheduling, accept/reject/complete/cancel" },
    { name: "Classroom", description: "Live class attendance and session control" },
    { name: "Recordings", description: "Class video recording upload and streaming" },
    { name: "Content", description: "PDF content upload and delivery per booking" },
    { name: "Analytics", description: "Center overview, revenue, teacher performance" },
    { name: "Two-Factor Auth", description: "TOTP setup, verify, disable, backup codes" },
    { name: "Agora", description: "Agora RTC token generation and usage logging" },
    { name: "Parents", description: "Parent login, student visibility, messages" },
    { name: "Sub-Admins", description: "Sub-admin accounts and permissions" },
    { name: "Homework", description: "Homework assignment, submission, grading" },
    { name: "Quiz", description: "Quiz creation and student attempts" },
    { name: "Chat", description: "Group chats and direct messages" },
    { name: "Super Admin", description: "Platform-level center management (no tenant header needed)" },
    { name: "Public", description: "Public-facing endpoints (no auth needed)" },
    { name: "Health", description: "Server health checks" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from login endpoint. Include as `Authorization: Bearer <token>`",
      },
    },
    parameters: {
      CenterSlug: {
        name: "x-center-slug",
        in: "header",
        required: true,
        schema: { type: "string", example: "my-school" },
        description: "Slug of the center/school this request belongs to",
      },
      ObjectId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
        description: "MongoDB ObjectId",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Descriptive error message" },
        },
      },
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operation completed successfully" },
        },
      },
      Teacher: {
        type: "object",
        properties: {
          _id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          continent: { type: "string" },
          active: { type: "boolean" },
          ratePerClass: { type: "number" },
          photo: { type: "string", nullable: true },
          googleMeetLink: { type: "string", nullable: true },
          zoomLink: { type: "string", nullable: true },
          twoFactorEnabled: { type: "boolean" },
          hasAcceptedTerms: { type: "boolean" },
        },
      },
      Student: {
        type: "object",
        properties: {
          _id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          active: { type: "boolean" },
          classCredits: { type: "number" },
          rank: { type: "string", nullable: true },
          age: { type: "number", nullable: true },
          hasAcceptedTerms: { type: "boolean" },
        },
      },
      Booking: {
        type: "object",
        properties: {
          _id: { type: "string" },
          teacherId: { type: "string" },
          studentId: { type: "string" },
          scheduledTime: { type: "string", format: "date-time" },
          duration: { type: "number", description: "Duration in minutes" },
          classTitle: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "accepted", "rejected", "completed", "cancelled", "missed"],
          },
          topic: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          isTrial: { type: "boolean" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT auth token" },
          sessionToken: { type: "string", description: "Session token for multi-device management" },
          hasAcceptedTerms: { type: "boolean" },
        },
      },
    },
  },

  paths: {
    // ─────────────────────────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────────────────────────
    "/auth/teacher/login": {
      post: {
        tags: ["Auth"],
        summary: "Teacher login",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "teacher@school.com" },
                  password: { type: "string", format: "password", example: "SecurePass123" },
                  twoFactorToken: { type: "string", description: "6-digit TOTP code (if 2FA enabled)", example: "123456" },
                  backupCode: { type: "string", description: "Backup code (if TOTP unavailable)" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/LoginResponse" },
                    {
                      type: "object",
                      properties: {
                        teacher: { $ref: "#/components/schemas/Teacher" },
                        requires2FA: { type: "boolean", description: "True when 2FA is required but token not provided" },
                        pendingToken: { type: "string", description: "Short-lived token to complete 2FA" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          429: { description: "Too many login attempts" },
        },
      },
    },

    "/auth/student/login": {
      post: {
        tags: ["Auth"],
        summary: "Student login",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                  twoFactorToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/LoginResponse" },
                    { type: "object", properties: { student: { $ref: "#/components/schemas/Student" } } },
                  ],
                },
              },
            },
          },
          401: { description: "Invalid credentials" },
        },
      },
    },

    "/auth/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin login",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  email: { type: "string", format: "email" },
                  username: { type: "string" },
                  password: { type: "string", format: "password" },
                  twoFactorToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login successful", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          401: { description: "Invalid credentials" },
        },
      },
    },

    "/auth/verify": {
      get: {
        tags: ["Auth"],
        summary: "Verify teacher token and return profile",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: { description: "Token valid", content: { "application/json": { schema: { type: "object", properties: { teacher: { $ref: "#/components/schemas/Teacher" } } } } } },
          401: { description: "Invalid or expired token" },
        },
      },
    },

    "/auth/student/verify": {
      get: {
        tags: ["Auth"],
        summary: "Verify student token and return profile",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: { description: "Token valid", content: { "application/json": { schema: { type: "object", properties: { student: { $ref: "#/components/schemas/Student" } } } } } },
          401: { description: "Invalid or expired token" },
        },
      },
    },

    "/auth/accept-terms": {
      post: {
        tags: ["Auth"],
        summary: "Accept Terms & Conditions (one-time, any role)",
        description: "Marks the authenticated user as having accepted the T&C. Call this once after first login before the user can access the dashboard.",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: { description: "Terms accepted", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
          401: { description: "Invalid or expired token" },
        },
      },
    },

    "/auth/teacher/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Teacher change password",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password changed" },
          400: { description: "Current password incorrect" },
        },
      },
    },

    "/auth/teacher/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Teacher request password reset email",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } },
            },
          },
        },
        responses: {
          200: { description: "Reset email sent if account exists" },
        },
      },
    },

    "/auth/teacher/reset-password/{token}": {
      post: {
        tags: ["Auth"],
        summary: "Teacher reset password using email token",
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["newPassword"], properties: { newPassword: { type: "string", minLength: 8 } } },
            },
          },
        },
        responses: {
          200: { description: "Password reset successful" },
          400: { description: "Token invalid or expired" },
        },
      },
    },

    "/auth/sessions": {
      get: {
        tags: ["Auth"],
        summary: "List all active sessions for the authenticated user",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: {
            description: "Active sessions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sessionToken: { type: "string" },
                          deviceInfo: { type: "string" },
                          ipAddress: { type: "string" },
                          location: { type: "string" },
                          loginTime: { type: "string", format: "date-time" },
                          lastActivity: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh an expired JWT using a valid session token",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionToken", "expiredToken"],
                properties: {
                  sessionToken: { type: "string" },
                  expiredToken: { type: "string", description: "The expired JWT" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "New JWT issued", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
          401: { description: "Session token invalid or expired" },
        },
      },
    },

    "/auth/logout-session": {
      post: {
        tags: ["Auth"],
        summary: "Logout a specific session (by session token)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["sessionToken"], properties: { sessionToken: { type: "string" } } },
            },
          },
        },
        responses: {
          200: { description: "Session terminated" },
        },
      },
    },

    "/auth/logout-all-devices": {
      post: {
        tags: ["Auth"],
        summary: "Logout from all devices (revoke all sessions)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: { description: "All sessions terminated" },
        },
      },
    },

    "/auth/verify-2fa-login": {
      post: {
        tags: ["Auth"],
        summary: "Complete 2FA login using pending token + TOTP code",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["pendingToken"],
                properties: {
                  pendingToken: { type: "string", description: "Short-lived token from login response" },
                  twoFactorToken: { type: "string", description: "6-digit TOTP code" },
                  backupCode: { type: "string", description: "Backup code if authenticator unavailable" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "2FA verified — full token issued", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          401: { description: "Invalid code" },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // TEACHERS
    // ─────────────────────────────────────────────────────────────────
    "/teachers": {
      get: {
        tags: ["Teachers"],
        summary: "List all teachers (admin or teacher access)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: { description: "Array of teachers", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Teacher" } } } } },
        },
      },
      post: {
        tags: ["Teachers"],
        summary: "Create and invite a new teacher (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName", "email", "continent"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  email: { type: "string", format: "email" },
                  continent: { type: "string" },
                  ratePerClass: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Teacher created and invite email sent", content: { "application/json": { schema: { type: "object", properties: { teacher: { $ref: "#/components/schemas/Teacher" }, message: { type: "string" } } } } } },
          400: { description: "Validation error" },
        },
      },
    },

    "/teachers/for-booking": {
      get: {
        tags: ["Teachers"],
        summary: "Get teachers available for booking (student view)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: { description: "List of bookable teachers" },
        },
      },
    },

    "/teachers/{id}": {
      get: {
        tags: ["Teachers"],
        summary: "Get a single teacher by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: {
          200: { description: "Teacher object", content: { "application/json": { schema: { $ref: "#/components/schemas/Teacher" } } } },
          404: { description: "Teacher not found" },
        },
      },
      put: {
        tags: ["Teachers"],
        summary: "Update teacher (admin only — full update including password reset)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, ratePerClass: { type: "number" }, active: { type: "boolean" } } },
            },
          },
        },
        responses: {
          200: { description: "Teacher updated", content: { "application/json": { schema: { type: "object", properties: { teacher: { $ref: "#/components/schemas/Teacher" }, temporaryPassword: { type: "string", nullable: true } } } } } },
        },
      },
      delete: {
        tags: ["Teachers"],
        summary: "Soft-delete teacher and schedule data purge (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: {
          200: { description: "Teacher scheduled for deletion", content: { "application/json": { schema: { type: "object", properties: { scheduledDeletionAt: { type: "string", format: "date-time" }, teacher: { $ref: "#/components/schemas/Teacher" } } } } } },
        },
      },
    },

    "/teachers/{id}/profile": {
      patch: {
        tags: ["Teachers"],
        summary: "Update teacher profile (self or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { displayName: { type: "string" }, phone: { type: "string" }, bio: { type: "string" }, timezone: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Profile updated" } },
      },
    },

    "/teachers/{id}/zoom": {
      patch: {
        tags: ["Teachers"],
        summary: "Save or update teacher's Zoom meeting link",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["zoomLink"], properties: { zoomLink: { type: "string", format: "uri", example: "https://zoom.us/j/123456789" } } },
            },
          },
        },
        responses: { 200: { description: "Zoom link saved" } },
      },
    },

    "/teachers/{id}/google-meet": {
      patch: {
        tags: ["Teachers"],
        summary: "Save or update teacher's Google Meet link",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["googleMeetLink"], properties: { googleMeetLink: { type: "string", format: "uri", example: "https://meet.google.com/abc-xyz" } } },
            },
          },
        },
        responses: { 200: { description: "Google Meet link saved" } },
      },
    },

    "/teachers/{id}/photo": {
      post: {
        tags: ["Teachers"],
        summary: "Upload teacher profile photo",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", properties: { photo: { type: "string", format: "binary" } } } } },
        },
        responses: { 200: { description: "Photo uploaded", content: { "application/json": { schema: { type: "object", properties: { photo: { type: "string", format: "uri" } } } } } } },
      },
      delete: {
        tags: ["Teachers"],
        summary: "Remove teacher profile photo",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Photo removed" } },
      },
    },

    "/teachers/{id}/restore": {
      post: {
        tags: ["Teachers"],
        summary: "Cancel scheduled deletion and restore teacher",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Teacher restored" } },
      },
    },

    "/teachers/{id}/resend-invite": {
      post: {
        tags: ["Teachers"],
        summary: "Resend invite email to teacher",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Invite resent" } },
      },
    },

    "/teachers/verify-invite/{token}": {
      get: {
        tags: ["Teachers"],
        summary: "Verify teacher invite token (no auth needed)",
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Token valid — returns teacher preview", content: { "application/json": { schema: { type: "object", properties: { teacher: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" } } } } } } } },
          400: { description: "Token invalid or expired" },
        },
      },
    },

    "/teachers/setup-account": {
      post: {
        tags: ["Teachers"],
        summary: "Teacher sets password after invite (no auth needed)",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["token", "password", "confirmPassword"], properties: { token: { type: "string" }, password: { type: "string", minLength: 8 }, confirmPassword: { type: "string" } } },
            },
          },
        },
        responses: {
          200: { description: "Account set up — teacher can now login" },
          400: { description: "Token invalid or passwords don't match" },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // STUDENTS
    // ─────────────────────────────────────────────────────────────────
    "/students": {
      get: {
        tags: ["Students"],
        summary: "List all students (admin or teacher)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: { description: "Array of students", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Student" } } } } },
        },
      },
      post: {
        tags: ["Students"],
        summary: "Enroll a new student (admin or teacher)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName", "email"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  email: { type: "string", format: "email" },
                  age: { type: "number", nullable: true },
                  rank: { type: "string", nullable: true },
                  phone: { type: "string", nullable: true },
                  country: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Student enrolled and invite email sent" },
        },
      },
    },

    "/students/{id}": {
      get: {
        tags: ["Students"],
        summary: "Get a student by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Student object", content: { "application/json": { schema: { $ref: "#/components/schemas/Student" } } } } },
      },
      put: {
        tags: ["Students"],
        summary: "Update student details (admin or teacher)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, classCredits: { type: "number" }, rank: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Student updated" } },
      },
      delete: {
        tags: ["Students"],
        summary: "Soft-delete student (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Student scheduled for deletion" } },
      },
    },

    "/students/{id}/toggle": {
      patch: {
        tags: ["Students"],
        summary: "Enable or disable a student account (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["active"], properties: { active: { type: "boolean" } } },
            },
          },
        },
        responses: { 200: { description: "Status toggled" } },
      },
    },

    "/students/{id}/payment": {
      post: {
        tags: ["Students"],
        summary: "Record a payment and add class credits (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "classes"],
                properties: {
                  amount: { type: "number", example: 500000, description: "Amount in local currency" },
                  classes: { type: "integer", example: 10, description: "Number of class credits to add" },
                  method: { type: "string", example: "bank_transfer" },
                  status: { type: "string", enum: ["paid", "pending"], default: "paid" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Payment recorded and credits added" },
        },
      },
    },

    "/students/{id}/payments": {
      get: {
        tags: ["Students"],
        summary: "Get payment history for a student",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Payment records" } },
      },
    },

    "/students/{id}/reset-password": {
      post: {
        tags: ["Students"],
        summary: "Generate a temporary password for a student",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: {
          200: { description: "Temporary password generated", content: { "application/json": { schema: { type: "object", properties: { tempPassword: { type: "string" } } } } } },
        },
      },
    },

    "/students/streak": {
      get: {
        tags: ["Students"],
        summary: "Get the authenticated student's learning streak",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: {
            description: "Streak data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    currentStreak: { type: "integer" },
                    longestStreak: { type: "integer" },
                    lastActivityDate: { type: "string", format: "date" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // BOOKINGS
    // ─────────────────────────────────────────────────────────────────
    "/bookings": {
      get: {
        tags: ["Bookings"],
        summary: "Get all bookings (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: { 200: { description: "All bookings", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Booking" } } } } } },
      },
      post: {
        tags: ["Bookings"],
        summary: "Create a new booking",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["teacherId", "studentId", "scheduledTime", "duration", "classTitle"],
                properties: {
                  teacherId: { type: "string" },
                  studentId: { type: "string" },
                  scheduledTime: { type: "string", format: "date-time" },
                  duration: { type: "integer", description: "Duration in minutes", example: 60 },
                  classTitle: { type: "string" },
                  topic: { type: "string" },
                  notes: { type: "string" },
                  isTrial: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Booking created" },
          400: { description: "Validation error or student has no credits" },
        },
      },
    },

    "/bookings/{id}": {
      get: {
        tags: ["Bookings"],
        summary: "Get a single booking by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Booking object", content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } } } },
      },
      delete: {
        tags: ["Bookings"],
        summary: "Delete a booking (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Booking deleted" } },
      },
    },

    "/bookings/{id}/accept": {
      patch: {
        tags: ["Bookings"],
        summary: "Teacher accepts a booking",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Booking accepted" } },
      },
    },

    "/bookings/{id}/reject": {
      patch: {
        tags: ["Bookings"],
        summary: "Teacher rejects a booking",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { reason: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Booking rejected" } },
      },
    },

    "/bookings/{id}/complete": {
      patch: {
        tags: ["Bookings"],
        summary: "Mark booking as completed and deduct 1 student credit",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: {
          200: {
            description: "Booking completed",
            content: {
              "application/json": {
                schema: { type: "object", properties: { booking: { $ref: "#/components/schemas/Booking" }, student: { $ref: "#/components/schemas/Student" } } },
              },
            },
          },
        },
      },
    },

    "/bookings/{id}/cancel": {
      patch: {
        tags: ["Bookings"],
        summary: "Cancel a booking",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { reason: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Booking cancelled" } },
      },
    },

    "/bookings/teacher/{teacherId}": {
      get: {
        tags: ["Bookings"],
        summary: "Get all bookings for a specific teacher",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "teacherId", in: "path", required: true, schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "accepted", "rejected", "completed", "cancelled", "missed"] } },
        ],
        responses: { 200: { description: "Teacher bookings" } },
      },
    },

    "/bookings/student/{studentId}": {
      get: {
        tags: ["Bookings"],
        summary: "Get all bookings for a specific student",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Student bookings" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // CLASSROOM
    // ─────────────────────────────────────────────────────────────────
    "/classroom/attendance": {
      post: {
        tags: ["Classroom"],
        summary: "Log a classroom attendance event (join / leave / heartbeat)",
        description: "Called every ~30s (heartbeat) and on join/leave by both teacher and student. Used to detect whether both parties were present and for how long.",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bookingId", "userRole", "action"],
                properties: {
                  bookingId: { type: "string" },
                  userRole: { type: "string", enum: ["teacher", "student"] },
                  action: { type: "string", enum: ["join", "leave", "heartbeat"] },
                  timestamp: { type: "string", format: "date-time" },
                  activeTime: { type: "integer", description: "Seconds both parties have been active" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Attendance logged" } },
      },
    },

    "/classroom/auto-complete": {
      post: {
        tags: ["Classroom"],
        summary: "Auto-complete a booking when both parties have been present long enough",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bookingId"],
                properties: {
                  bookingId: { type: "string" },
                  clientBothActiveTime: { type: "integer", description: "Client-reported active time in seconds" },
                  callerRole: { type: "string", enum: ["teacher", "student"] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Completion result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    alreadyProcessed: { type: "boolean" },
                    completed: { type: "boolean" },
                    missed: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // RECORDINGS
    // ─────────────────────────────────────────────────────────────────
    "/recordings": {
      post: {
        tags: ["Recordings"],
        summary: "Upload a class recording video (teacher only)",
        description: "Accepts a video file (webm or mp4). Stored on S3 or local disk depending on config. Large files may take a while — progress is tracked client-side via the upload queue context.",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["video", "bookingId"],
                properties: {
                  video: { type: "string", format: "binary", description: ".webm or .mp4 recording" },
                  bookingId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Recording saved", content: { "application/json": { schema: { type: "object", properties: { recording: { type: "object" }, message: { type: "string" } } } } } },
          400: { description: "No file or booking not found" },
        },
      },
    },

    "/recordings/{id}/stream": {
      get: {
        tags: ["Recordings"],
        summary: "Stream or download a recording (authenticated)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: {
          200: { description: "Video stream or redirect to presigned S3 URL" },
          403: { description: "Not authorized to view this recording" },
          404: { description: "Recording not found" },
        },
      },
    },

    "/recordings/{id}": {
      delete: {
        tags: ["Recordings"],
        summary: "Delete a recording (admin or owner)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Recording deleted" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // CONTENT (PDF per booking)
    // ─────────────────────────────────────────────────────────────────
    "/content/upload": {
      post: {
        tags: ["Content"],
        summary: "Upload a PDF for a booking (teacher or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["pdf", "bookingId"],
                properties: {
                  pdf: { type: "string", format: "binary" },
                  bookingId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "PDF uploaded", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, bookingId: { type: "string" }, size: { type: "integer" } } } } } } },
      },
    },

    "/content/info/{bookingId}": {
      get: {
        tags: ["Content"],
        summary: "Check if a PDF exists for a booking",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "bookingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Content info", content: { "application/json": { schema: { type: "object", properties: { hasPdf: { type: "boolean" }, bookingId: { type: "string" }, size: { type: "integer", nullable: true } } } } } } },
      },
    },

    "/content/file/{bookingId}": {
      get: {
        tags: ["Content"],
        summary: "Get the PDF file for a booking (redirect to presigned URL or direct stream)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "bookingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "PDF file or redirect to S3 URL" },
          404: { description: "No PDF for this booking" },
        },
      },
    },

    "/content/{bookingId}": {
      delete: {
        tags: ["Content"],
        summary: "Delete PDF for a booking (teacher or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "bookingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "PDF deleted" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // ANALYTICS
    // ─────────────────────────────────────────────────────────────────
    "/analytics/overview": {
      get: {
        tags: ["Analytics"],
        summary: "Center overview stats (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: {
            description: "Overview data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        users: { type: "object" },
                        bookings: { type: "object" },
                        revenue: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/analytics/bookings-timeline": {
      get: {
        tags: ["Analytics"],
        summary: "Booking count over time (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "period", in: "query", schema: { type: "string", enum: ["day", "week", "month"], default: "week" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Timeline data" } },
      },
    },

    "/analytics/teacher-performance": {
      get: {
        tags: ["Analytics"],
        summary: "Teacher performance leaderboard (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { 200: { description: "Teacher performance stats" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // TWO-FACTOR AUTH
    // ─────────────────────────────────────────────────────────────────
    "/2fa/setup": {
      post: {
        tags: ["Two-Factor Auth"],
        summary: "Generate a TOTP secret and QR code to set up 2FA",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: {
            description: "QR code and secret",
            content: {
              "application/json": {
                schema: { type: "object", properties: { qrCode: { type: "string", description: "Data URI for QR code image" }, secret: { type: "string" }, message: { type: "string" } } },
              },
            },
          },
        },
      },
    },

    "/2fa/verify": {
      post: {
        tags: ["Two-Factor Auth"],
        summary: "Verify TOTP code to activate 2FA and receive backup codes",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["token"], properties: { token: { type: "string", description: "6-digit TOTP code", example: "123456" } } },
            },
          },
        },
        responses: {
          200: {
            description: "2FA activated",
            content: {
              "application/json": {
                schema: { type: "object", properties: { backupCodes: { type: "array", items: { type: "string" } }, message: { type: "string" } } },
              },
            },
          },
        },
      },
    },

    "/2fa/disable": {
      post: {
        tags: ["Two-Factor Auth"],
        summary: "Disable 2FA (requires password confirmation)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["password"], properties: { password: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "2FA disabled" }, 401: { description: "Wrong password" } },
      },
    },

    "/2fa/status": {
      get: {
        tags: ["Two-Factor Auth"],
        summary: "Check 2FA status for the authenticated user",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: {
            description: "2FA status",
            content: {
              "application/json": {
                schema: { type: "object", properties: { twoFactorEnabled: { type: "boolean" }, twoFactorVerified: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },

    "/2fa/regenerate-backup-codes": {
      post: {
        tags: ["Two-Factor Auth"],
        summary: "Regenerate backup codes (requires password)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["password"], properties: { password: { type: "string" } } },
            },
          },
        },
        responses: {
          200: {
            description: "New backup codes",
            content: {
              "application/json": {
                schema: { type: "object", properties: { backupCodes: { type: "array", items: { type: "string" } }, message: { type: "string" } } },
              },
            },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // AGORA
    // ─────────────────────────────────────────────────────────────────
    "/agora/token": {
      get: {
        tags: ["Agora"],
        summary: "Generate an Agora RTC token for a channel",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "channel", in: "query", required: true, schema: { type: "string" }, description: "Agora channel name (usually bookingId)" },
        ],
        responses: {
          200: {
            description: "Token issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    appId: { type: "string" },
                    channel: { type: "string" },
                    uid: { type: "integer" },
                    expiresAt: { type: "integer", description: "Unix timestamp" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/agora/status": {
      get: {
        tags: ["Agora"],
        summary: "Check if Agora is configured on this server",
        responses: {
          200: {
            description: "Agora config status",
            content: {
              "application/json": {
                schema: { type: "object", properties: { configured: { type: "boolean" }, message: { type: "string" } } },
              },
            },
          },
        },
      },
    },

    "/agora-usage/start": {
      post: {
        tags: ["Agora"],
        summary: "Log Agora session start",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["channelName", "bookingId"], properties: { channelName: { type: "string" }, bookingId: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Session start logged" } },
      },
    },

    "/agora-usage/end": {
      post: {
        tags: ["Agora"],
        summary: "Log Agora session end and save duration",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["bookingId"], properties: { bookingId: { type: "string" } } },
            },
          },
        },
        responses: {
          200: {
            description: "Session end logged",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" }, durationMinutes: { type: "number" } } },
              },
            },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // PARENTS
    // ─────────────────────────────────────────────────────────────────
    "/parents/login": {
      post: {
        tags: ["Parents"],
        summary: "Parent login",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { allOf: [{ $ref: "#/components/schemas/LoginResponse" }, { type: "object", properties: { parent: { type: "object" } } }] },
              },
            },
          },
        },
      },
    },

    "/parents/verify": {
      get: {
        tags: ["Parents"],
        summary: "Verify parent token",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: { 200: { description: "Token valid — returns parent profile" } },
      },
    },

    "/parents/setup/{token}": {
      post: {
        tags: ["Parents"],
        summary: "Set up parent account password (from invite email)",
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["password"], properties: { password: { type: "string", minLength: 8 } } },
            },
          },
        },
        responses: { 200: { description: "Account set up" } },
      },
    },

    "/parents/change-password": {
      post: {
        tags: ["Parents"],
        summary: "Parent change password",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 8 } } },
            },
          },
        },
        responses: { 200: { description: "Password changed" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // SUB-ADMINS
    // ─────────────────────────────────────────────────────────────────
    "/sub-admin/login": {
      post: {
        tags: ["Sub-Admins"],
        summary: "Sub-admin login",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Login successful" } },
      },
    },

    "/sub-admins": {
      get: {
        tags: ["Sub-Admins"],
        summary: "List all sub-admins (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: { 200: { description: "Array of sub-admins" } },
      },
      post: {
        tags: ["Sub-Admins"],
        summary: "Create a new sub-admin account (admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["firstName", "lastName", "email"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string", format: "email" } } },
            },
          },
        },
        responses: { 201: { description: "Sub-admin created" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // HOMEWORK
    // ─────────────────────────────────────────────────────────────────
    "/homework": {
      get: {
        tags: ["Homework"],
        summary: "List homework assignments",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Homework list" } },
      },
      post: {
        tags: ["Homework"],
        summary: "Assign homework to a student (teacher or admin)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["studentId", "title"],
                properties: {
                  studentId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  dueDate: { type: "string", format: "date-time" },
                  "files[]": { type: "array", items: { type: "string", format: "binary" } },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Homework assigned" } },
      },
    },

    "/homework/{id}/submit": {
      post: {
        tags: ["Homework"],
        summary: "Student submits homework",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }, { $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string" },
                  "files[]": { type: "array", items: { type: "string", format: "binary" } },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Homework submitted" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // QUIZ
    // ─────────────────────────────────────────────────────────────────
    "/quiz": {
      post: {
        tags: ["Quiz"],
        summary: "Create a quiz for a student (teacher only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "title", "questions"],
                properties: {
                  studentId: { type: "string" },
                  title: { type: "string" },
                  instructions: { type: "string" },
                  timeLimit: { type: "integer", description: "Minutes" },
                  dueDate: { type: "string", format: "date-time" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctAnswer: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Quiz created" } },
      },
    },

    "/quiz/my": {
      get: {
        tags: ["Quiz"],
        summary: "Get all quizzes for the authenticated student",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: { 200: { description: "Student quiz list" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // CHAT
    // ─────────────────────────────────────────────────────────────────
    "/group-chats": {
      get: {
        tags: ["Chat"],
        summary: "List group chats for the authenticated user",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Group chats", content: { "application/json": { schema: { type: "object", properties: { chats: { type: "array" }, hasMore: { type: "boolean" } } } } } } },
      },
    },

    "/group-chats/{chatId}/messages": {
      get: {
        tags: ["Chat"],
        summary: "Get messages in a group chat",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "chatId", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Messages list" } },
      },
      post: {
        tags: ["Chat"],
        summary: "Send a message to a group chat",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "chatId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Message sent" } },
      },
    },

    "/direct-messages": {
      get: {
        tags: ["Chat"],
        summary: "List direct message conversations",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "DM conversations" } },
      },
    },

    "/direct-messages/{dmId}/messages": {
      get: {
        tags: ["Chat"],
        summary: "Get messages in a direct message thread",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "dmId", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Messages list" } },
      },
      post: {
        tags: ["Chat"],
        summary: "Send a direct message",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/CenterSlug" },
          { name: "dmId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Message sent" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // SUPER ADMIN (no x-center-slug needed)
    // ─────────────────────────────────────────────────────────────────
    "/super-admin/login": {
      post: {
        tags: ["Super Admin"],
        summary: "Super admin login (no center slug needed)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { type: "object", properties: { token: { type: "string" }, superAdmin: { type: "object" }, sessionToken: { type: "string" } } },
              },
            },
          },
          401: { description: "Invalid credentials" },
        },
      },
    },

    "/super-admin/centers": {
      get: {
        tags: ["Super Admin"],
        summary: "List all centers",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "All registered centers with status, plan, and usage data" },
        },
      },
    },

    "/super-admin/centers/{id}/approve": {
      post: {
        tags: ["Super Admin"],
        summary: "Approve a pending center registration — creates the center's database",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Center approved and database provisioned" } },
      },
    },

    "/super-admin/centers/{id}/reject": {
      post: {
        tags: ["Super Admin"],
        summary: "Reject a pending center registration",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ObjectId" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { reason: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Registration rejected" } },
      },
    },

    "/super-admin/centers/{id}/suspend": {
      post: {
        tags: ["Super Admin"],
        summary: "Suspend an active center",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Center suspended" } },
      },
    },

    "/super-admin/centers/{id}/reactivate": {
      post: {
        tags: ["Super Admin"],
        summary: "Reactivate a suspended center",
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ObjectId" }],
        responses: { 200: { description: "Center reactivated" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // PUBLIC
    // ─────────────────────────────────────────────────────────────────
    "/public/landing-page": {
      get: {
        tags: ["Public"],
        summary: "Get center landing page data (public — no auth needed)",
        description: "Returns the center's public info and landing page config. Used by the public website templates.",
        parameters: [{ $ref: "#/components/parameters/CenterSlug" }],
        responses: {
          200: {
            description: "Landing page data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    center: { type: "object", properties: { centerName: { type: "string" }, slug: { type: "string" } } },
                    landingPage: { type: "object" },
                  },
                },
              },
            },
          },
          404: { description: "Center not found" },
        },
      },
    },

    "/public/contact": {
      post: {
        tags: ["Public"],
        summary: "Submit a contact / enquiry form (public — no auth needed)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "message"],
                properties: {
                  name: { type: "string" },
                  organization: { type: "string" },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  service: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Enquiry submitted" } },
      },
    },

    // ─────────────────────────────────────────────────────────────────
    // HEALTH
    // ─────────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Full health check — DB, email, Redis, memory",
        responses: {
          200: {
            description: "All systems healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "healthy" },
                    uptime: { type: "number" },
                    database: { type: "string" },
                    email: { type: "string" },
                    redis: { type: "string" },
                  },
                },
              },
            },
          },
          503: { description: "One or more systems unhealthy" },
        },
      },
    },
  },
};

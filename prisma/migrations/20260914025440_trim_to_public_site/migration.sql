/*
  Warnings:

  - You are about to drop the column `userId` on the `security_events` table. All the data in the column will be lost.
  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `availability_exceptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `availability_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `calendar_sync_state` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `crypto_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `data_subject_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `oauth_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `otp_challenges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refunds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `therapist_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `video_meetings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clientId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_therapistId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "availability_exceptions" DROP CONSTRAINT "availability_exceptions_therapistId_fkey";

-- DropForeignKey
ALTER TABLE "availability_rules" DROP CONSTRAINT "availability_rules_therapistId_fkey";

-- DropForeignKey
ALTER TABLE "calendar_sync_state" DROP CONSTRAINT "calendar_sync_state_therapistId_fkey";

-- DropForeignKey
ALTER TABLE "client_profiles" DROP CONSTRAINT "client_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "consents" DROP CONSTRAINT "consents_userId_fkey";

-- DropForeignKey
ALTER TABLE "crypto_invoices" DROP CONSTRAINT "crypto_invoices_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "data_subject_requests" DROP CONSTRAINT "data_subject_requests_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "oauth_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_events" DROP CONSTRAINT "payment_events_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_clientId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "security_events" DROP CONSTRAINT "security_events_userId_fkey";

-- DropForeignKey
ALTER TABLE "session_notes" DROP CONSTRAINT "session_notes_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "session_notes" DROP CONSTRAINT "session_notes_authorId_fkey";

-- DropForeignKey
ALTER TABLE "therapist_profiles" DROP CONSTRAINT "therapist_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "video_meetings" DROP CONSTRAINT "video_meetings_appointmentId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "actorId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "security_events" DROP COLUMN "userId";

-- DropTable
DROP TABLE "appointments";

-- DropTable
DROP TABLE "auth_sessions";

-- DropTable
DROP TABLE "availability_exceptions";

-- DropTable
DROP TABLE "availability_rules";

-- DropTable
DROP TABLE "calendar_sync_state";

-- DropTable
DROP TABLE "client_profiles";

-- DropTable
DROP TABLE "consents";

-- DropTable
DROP TABLE "crypto_invoices";

-- DropTable
DROP TABLE "data_subject_requests";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "oauth_accounts";

-- DropTable
DROP TABLE "otp_challenges";

-- DropTable
DROP TABLE "payment_events";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropTable
DROP TABLE "refunds";

-- DropTable
DROP TABLE "session_notes";

-- DropTable
DROP TABLE "therapist_profiles";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "video_meetings";

-- DropEnum
DROP TYPE "AppointmentStatus";

-- DropEnum
DROP TYPE "ConsentType";

-- DropEnum
DROP TYPE "DsrKind";

-- DropEnum
DROP TYPE "DsrStatus";

-- DropEnum
DROP TYPE "ExceptionKind";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "OAuthProvider";

-- DropEnum
DROP TYPE "OtpChannel";

-- DropEnum
DROP TYPE "PaymentProviderKind";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "RefundStatus";

-- DropEnum
DROP TYPE "SyncStatus";

-- DropEnum
DROP TYPE "UserRole";

-- DropEnum
DROP TYPE "UserStatus";

-- DropEnum
DROP TYPE "VideoProvider";

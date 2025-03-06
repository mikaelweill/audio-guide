-- AlterTable
ALTER TABLE "Poi" ADD COLUMN     "audio_generated_at" TIMESTAMP(3),
ADD COLUMN     "brief_audio_url" TEXT,
ADD COLUMN     "brief_transcript" TEXT,
ADD COLUMN     "complete_audio_url" TEXT,
ADD COLUMN     "complete_transcript" TEXT,
ADD COLUMN     "detailed_audio_url" TEXT,
ADD COLUMN     "detailed_transcript" TEXT;

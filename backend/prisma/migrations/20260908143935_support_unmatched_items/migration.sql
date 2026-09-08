-- AlterEnum
ALTER TYPE "ItemStatus" ADD VALUE 'UNMATCHED';

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_audioFileId_fkey";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "transcriptSourcePath" TEXT,
ALTER COLUMN "audioFileId" DROP NOT NULL,
ALTER COLUMN "originalTranscript" DROP NOT NULL,
ALTER COLUMN "correctedTranscript" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'UNMATCHED';

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "AudioFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

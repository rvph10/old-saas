-- AlterTable
ALTER TABLE "UserDevice" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "os" TEXT;

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

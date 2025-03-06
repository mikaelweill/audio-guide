-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL,
    "start_location" JSONB NOT NULL,
    "end_location" JSONB NOT NULL,
    "return_to_start" BOOLEAN NOT NULL DEFAULT false,
    "transportation_mode" TEXT NOT NULL,
    "total_distance" DOUBLE PRECISION NOT NULL,
    "total_duration" INTEGER NOT NULL,
    "google_maps_url" TEXT,
    "preferences" JSONB NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poi" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vicinity" TEXT,
    "formatted_address" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "types" JSONB NOT NULL,
    "rating" DOUBLE PRECISION,
    "user_ratings_total" INTEGER,
    "website" TEXT,
    "phone_number" TEXT,
    "price_level" INTEGER,
    "opening_hours" JSONB,
    "google_maps_url" TEXT,
    "thumbnail_url" TEXT,
    "photo_references" JSONB,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourPoi" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "poi_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "distance_to_next" DOUBLE PRECISION,
    "time_to_next" INTEGER,
    "custom_notes" TEXT,

    CONSTRAINT "TourPoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Poi_place_id_key" ON "Poi"("place_id");

-- CreateIndex
CREATE INDEX "TourPoi_tour_id_idx" ON "TourPoi"("tour_id");

-- CreateIndex
CREATE UNIQUE INDEX "TourPoi_tour_id_poi_id_key" ON "TourPoi"("tour_id", "poi_id");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourPoi" ADD CONSTRAINT "TourPoi_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourPoi" ADD CONSTRAINT "TourPoi_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "Poi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

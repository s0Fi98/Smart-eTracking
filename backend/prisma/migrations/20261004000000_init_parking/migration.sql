-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `platform_role` ENUM('USER', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legal_name` VARCHAR(191) NULL,
    `registration_number` VARCHAR(100) NULL,
    `tax_number` VARCHAR(50) NULL,
    `contact_person` VARCHAR(120) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `organization_members_user_id_status_idx`(`user_id`, `status`),
    UNIQUE INDEX `organization_members_organization_id_user_id_key`(`organization_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parking_areas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `authority` VARCHAR(191) NOT NULL DEFAULT 'Guwahati Municipal Corporation',
    `address` TEXT NOT NULL,
    `ward` VARCHAR(50) NULL,
    `area_sqft` INTEGER NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    `status` ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `parking_areas_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parking_leases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parking_area_id` INTEGER NOT NULL,
    `organization_id` INTEGER NOT NULL,
    `work_order_no` VARCHAR(100) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `parking_leases_parking_area_id_status_starts_at_ends_at_idx`(`parking_area_id`, `status`, `starts_at`, `ends_at`),
    INDEX `parking_leases_organization_id_status_idx`(`organization_id`, `status`),
    UNIQUE INDEX `parking_leases_parking_area_id_work_order_no_key`(`parking_area_id`, `work_order_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `member_id` INTEGER NOT NULL,
    `lease_id` INTEGER NOT NULL,
    `role` ENUM('MANAGER', 'OPERATOR', 'TICKET_COLLECTOR', 'VIEWER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `site_assignments_lease_id_status_idx`(`lease_id`, `status`),
    UNIQUE INDEX `site_assignments_member_id_lease_id_role_key`(`member_id`, `lease_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opening_hours` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parking_area_id` INTEGER NOT NULL,
    `weekday` TINYINT UNSIGNED NOT NULL,
    `opens_minute` SMALLINT UNSIGNED NOT NULL,
    `closes_minute` SMALLINT UNSIGNED NOT NULL,

    UNIQUE INDEX `opening_hours_parking_area_id_weekday_opens_minute_key`(`parking_area_id`, `weekday`, `opens_minute`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_closures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parking_area_id` INTEGER NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,

    INDEX `site_closures_parking_area_id_starts_at_ends_at_idx`(`parking_area_id`, `starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parking_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parking_area_id` INTEGER NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `zone` VARCHAR(50) NULL,
    `floor` VARCHAR(30) NULL,
    `vehicle_type` ENUM('TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'HEAVY_VEHICLE') NOT NULL,
    `is_accessible` BOOLEAN NOT NULL DEFAULT false,
    `has_charger` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'OUT_OF_SERVICE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `parking_slots_parking_area_id_vehicle_type_status_idx`(`parking_area_id`, `vehicle_type`, `status`),
    UNIQUE INDEX `parking_slots_parking_area_id_code_key`(`parking_area_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_qr_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parking_area_id` INTEGER NOT NULL,
    `token` VARCHAR(36) NOT NULL,
    `label` VARCHAR(100) NULL,
    `expires_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `site_qr_codes_token_key`(`token`),
    INDEX `site_qr_codes_parking_area_id_idx`(`parking_area_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `registration_number` VARCHAR(30) NOT NULL,
    `vehicle_type` ENUM('TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'HEAVY_VEHICLE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vehicles_user_id_registration_number_key`(`user_id`, `registration_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lease_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `vehicle_type` ENUM('TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'HEAVY_VEHICLE') NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `duration_minutes` INTEGER UNSIGNED NOT NULL,
    `price_minor` BIGINT UNSIGNED NOT NULL,
    `grace_minutes` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `overtime_unit_minutes` INTEGER UNSIGNED NOT NULL,
    `overtime_price_minor` BIGINT UNSIGNED NOT NULL,
    `valid_from` DATETIME(3) NOT NULL,
    `valid_until` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_plans_lease_id_vehicle_type_is_active_valid_from_idx`(`lease_id`, `vehicle_type`, `is_active`, `valid_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(36) NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `lease_id` INTEGER NOT NULL,
    `slot_id` INTEGER NOT NULL,
    `vehicle_id` INTEGER NULL,
    `price_plan_id` INTEGER NOT NULL,
    `qr_code_id` INTEGER NULL,
    `vehicle_registration` VARCHAR(30) NOT NULL,
    `vehicle_type` ENUM('TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'HEAVY_VEHICLE') NOT NULL,
    `status` ENUM('HELD', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW') NOT NULL DEFAULT 'HELD',
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `hold_expires_at` DATETIME(3) NULL,
    `checked_in_at` DATETIME(3) NULL,
    `checked_out_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` VARCHAR(255) NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `subtotal_minor` BIGINT UNSIGNED NOT NULL,
    `tax_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `discount_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `overtime_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `total_minor` BIGINT UNSIGNED NOT NULL,
    `pricing_snapshot` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_reference_key`(`reference`),
    UNIQUE INDEX `bookings_idempotency_key_key`(`idempotency_key`),
    INDEX `bookings_slot_id_status_starts_at_ends_at_idx`(`slot_id`, `status`, `starts_at`, `ends_at`),
    INDEX `bookings_lease_id_status_starts_at_idx`(`lease_id`, `status`, `starts_at`),
    INDEX `bookings_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `bookings_status_hold_expires_at_idx`(`status`, `hold_expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_order_id` VARCHAR(191) NULL,
    `provider_payment_id` VARCHAR(191) NULL,
    `method` ENUM('UPI', 'CARD', 'NET_BANKING', 'CASH') NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `amount_minor` BIGINT UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `paid_at` DATETIME(3) NULL,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_idempotency_key_key`(`idempotency_key`),
    INDEX `payments_provider_provider_order_id_idx`(`provider`, `provider_order_id`),
    INDEX `payments_booking_id_status_idx`(`booking_id`, `status`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `payments_provider_provider_payment_id_key`(`provider`, `provider_payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_refund_id` VARCHAR(191) NULL,
    `amount_minor` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refunds_idempotency_key_key`(`idempotency_key`),
    INDEX `refunds_payment_id_status_idx`(`payment_id`, `status`),
    UNIQUE INDEX `refunds_provider_provider_refund_id_key`(`provider`, `provider_refund_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_event_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `payload` JSON NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `payment_events_payment_id_idx`(`payment_id`),
    INDEX `payment_events_processed_at_received_at_idx`(`processed_at`, `received_at`),
    UNIQUE INDEX `payment_events_provider_provider_event_id_key`(`provider`, `provider_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(100) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parking_leases` ADD CONSTRAINT `parking_leases_parking_area_id_fkey` FOREIGN KEY (`parking_area_id`) REFERENCES `parking_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parking_leases` ADD CONSTRAINT `parking_leases_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_assignments` ADD CONSTRAINT `site_assignments_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `organization_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_assignments` ADD CONSTRAINT `site_assignments_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `parking_leases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_hours` ADD CONSTRAINT `opening_hours_parking_area_id_fkey` FOREIGN KEY (`parking_area_id`) REFERENCES `parking_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_closures` ADD CONSTRAINT `site_closures_parking_area_id_fkey` FOREIGN KEY (`parking_area_id`) REFERENCES `parking_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parking_slots` ADD CONSTRAINT `parking_slots_parking_area_id_fkey` FOREIGN KEY (`parking_area_id`) REFERENCES `parking_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_qr_codes` ADD CONSTRAINT `site_qr_codes_parking_area_id_fkey` FOREIGN KEY (`parking_area_id`) REFERENCES `parking_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_plans` ADD CONSTRAINT `price_plans_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `parking_leases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_lease_id_fkey` FOREIGN KEY (`lease_id`) REFERENCES `parking_leases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `parking_slots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_price_plan_id_fkey` FOREIGN KEY (`price_plan_id`) REFERENCES `price_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_qr_code_id_fkey` FOREIGN KEY (`qr_code_id`) REFERENCES `site_qr_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

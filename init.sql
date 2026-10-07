-- ============================================================
-- 宠物领养管理系统 — 数据库表结构
-- 由 `npm run db:init` 执行；数据库本身由脚本按 .env 中的 DB_NAME 创建
-- ============================================================

SET NAMES utf8mb4;

-- ============================================================
-- 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `username`      VARCHAR(50)  NOT NULL                COMMENT '登录名',
  `password_hash` VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希，绝不存明文',
  `nickname`      VARCHAR(50)  DEFAULT NULL            COMMENT '昵称',
  `role`          ENUM('user','admin') NOT NULL DEFAULT 'user' COMMENT '角色',
  `phone`         VARCHAR(20)  DEFAULT NULL            COMMENT '手机号',
  `status`        TINYINT      NOT NULL DEFAULT 1      COMMENT '1=正常 0=禁用',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 宠物表
-- status: available=待领养 / pending=审核中 / adopted=已领养 / offline=已下架
-- ============================================================
CREATE TABLE IF NOT EXISTS `pets` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(50)  NOT NULL                COMMENT '名字',
  `category`      VARCHAR(30)  NOT NULL                COMMENT '分类：猫/狗/兔…',
  `breed`         VARCHAR(50)  DEFAULT NULL            COMMENT '品种',
  `sex`           ENUM('公','母') NOT NULL             COMMENT '性别',
  `age`           INT          NOT NULL                COMMENT '年龄（月）',
  `weight`        DECIMAL(5,2) DEFAULT NULL            COMMENT '体重（kg）',
  `health_status` VARCHAR(30)  DEFAULT '健康'          COMMENT '健康状况',
  `description`   VARCHAR(1000) DEFAULT NULL           COMMENT '介绍',
  `image_url`     VARCHAR(255) DEFAULT NULL            COMMENT '图片地址',
  `status`        ENUM('available','pending','adopted','offline') NOT NULL DEFAULT 'available',
  `view_count`    INT          NOT NULL DEFAULT 0      COMMENT '浏览量',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物信息表';

-- ============================================================
-- 领养申请表
-- 外键：申请单随宠物/用户删除而级联删除；审核人删除后置空
-- ============================================================
CREATE TABLE IF NOT EXISTS `adoptions` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `pet_id`         INT          NOT NULL               COMMENT '宠物ID',
  `applicant_id`   INT          NOT NULL               COMMENT '申请人ID',
  `reason`         VARCHAR(500) NOT NULL               COMMENT '领养理由',
  `contact_phone`  VARCHAR(20)  NOT NULL               COMMENT '联系电话',
  `address`        VARCHAR(200) NOT NULL               COMMENT '联系地址',
  `status`         ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `review_remark`  VARCHAR(255) DEFAULT NULL           COMMENT '审核意见',
  `reviewed_by`    INT          DEFAULT NULL           COMMENT '审核人ID',
  `reviewed_at`    TIMESTAMP    NULL DEFAULT NULL      COMMENT '审核时间',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_status` (`status`),
  KEY `idx_pet` (`pet_id`),
  KEY `idx_applicant` (`applicant_id`),
  CONSTRAINT `fk_adoption_pet` FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adoption_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adoption_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领养申请表';

-- ============================================
-- 宠物领养管理系统 — 数据库初始化脚本
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS pet_adoption DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE pet_adoption;

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  username VARCHAR(50) NOT NULL COMMENT '用户名',
  password VARCHAR(100) NOT NULL COMMENT '密码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 宠物表
-- ============================================
CREATE TABLE IF NOT EXISTS pets (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '宠物ID',
  category VARCHAR(50) NOT NULL COMMENT '宠物分类（如：猫、狗、兔子等）',
  name VARCHAR(50) NOT NULL COMMENT '宠物名称',
  sex VARCHAR(10) NOT NULL COMMENT '性别（公/母）',
  age INT NOT NULL COMMENT '年龄（月）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物信息表';

-- ============================================
-- 插入测试数据（可选）
-- ============================================
-- INSERT INTO users (username, password) VALUES ('admin', '123456');
-- INSERT INTO pets (category, name, sex, age) VALUES ('猫', '小花', '母', 6);
-- INSERT INTO pets (category, name, sex, age) VALUES ('狗', '旺财', '公', 12);

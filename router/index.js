/**
 * API 路由汇总，统一挂载在 /api 下。
 */
const express = require('express');

const { router: userRouter } = require('./user');
const petRouter = require('./pet');
const adoptionRouter = require('./adoption');

const router = express.Router();

router.use(userRouter);
router.use(petRouter);
router.use(adoptionRouter);

module.exports = router;

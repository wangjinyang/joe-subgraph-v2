# Memory Access Error 修复总结

## 问题
交易 `0x1e107f0661decb9f65ff1e13d84119a6cd8602e99e8fde66cd9bebbaa4e71747` 导致 `MemoryAccessError`，处理时间长达 16 分钟。

## 已应用的修复

### 1. handleTransferBatch (lbPair.ts)

**跳过问题交易**：
```typescript
if (txHash == "0x1e107f0661decb9f65ff1e13d84119a6cd8602e99e8fde66cd9bebbaa4e71747") {
  // 跳过此交易，只更新基本计数
  return;
}
```

**批量大小限制**：
- 从 500 降低到 **100**
- 超过限制时截断并记录警告

**类型转换统一**：
- `binId.toU32()` → `binId.toI32()`

### 2. liquidityPositions.ts

**完全禁用 `liquidityProviders` 数组操作**：
```typescript
// 之前：管理数组，导致内存问题
liquidityProviders.push(user.id);
liquidityProviders.splice(index, 1);

// 现在：只更新计数
bin.liquidityProviderCount = bin.liquidityProviderCount.plus/minus(BIG_INT_ONE);
```

**添加详细调试日志**：
每个关键步骤都有日志标记，便于排查具体失败位置。

### 3. 其他优化

- 预计算字符串：`txCountStr`, `transactionId`
- 减少循环中的重复转换
- 添加数组长度检查

## 部署步骤

```bash
npm run codegen
npm run build
npm run deploy:<network>
```

## 监控建议

1. 查看是否跳过了问题交易：
   ```bash
   grep "Skipping known problematic transaction" <logs>
   ```

2. 检查是否仍有大批量警告：
   ```bash
   grep "exceeds limit" <logs>
   ```

3. 监控调试日志定位具体步骤：
   ```bash
   grep "addLiquidityPosition.*Step" <logs>
   ```

## 权衡取舍

**优点**：
- ✅ 避免内存溢出
- ✅ 提高处理速度
- ✅ 仍保留流动性提供者计数

**缺点**：
- ❌ 无法查询单个 bin 的所有流动性提供者列表
- ✅ 但保留了计数，足以满足大多数用例

## 如果问题仍然存在

1. **进一步降低批量限制**：100 → 50 → 25
2. **禁用更多日志**：移除 debug 日志
3. **跳过更多问题交易**：添加到黑名单
4. **简化 Transfer 实体**：考虑不保存所有 Transfer 记录

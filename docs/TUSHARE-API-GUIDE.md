# Tushare API 集成指南

## 概述

本文档提供了通过 Tushare Pro 获取金融数据的详细指南，适用于开发研报自动生成系统或其他金融数据分析应用。Tushare Pro 提供了丰富的金融数据接口，包括股票、基金、期货、债券、外汇等多种金融工具的数据。

## API 调用基础

### HTTP API 格式

Tushare Pro 提供基于 HTTP 的 RESTful API，通过 POST 请求发送 JSON 格式的参数获取数据：

```
POST http://api.tushare.pro
Content-Type: application/json

{
    "api_name": "接口名称",
    "token": "用户唯一标识",
    "params": {"参数1": "值1", "参数2": "值2"...},
    "fields": "需要的字段列表"
}
```

### 输入参数说明

- **api_name**：接口名称，如 `stock_basic`
- **token**：用户唯一标识，通过登录 Tushare Pro 网站获取
- **params**：接口所需参数，如日期范围、股票代码等
- **fields**：需要获取的字段，以逗号分隔，如 `"open,high,low,close"`

### 输出参数说明

```json
{
    "code": 0,           // 返回码，0表示成功，2002表示权限问题
    "msg": null,         // 错误信息
    "data": {
        "fields": [],    // 字段列表
        "items": []      // 数据内容，二维数组
    }
}
```

## 研报所需数据及接口

为构建完整的研报生成系统，以下是核心数据类别及对应的接口：

### 1. 基础信息

#### 股票基础数据
- **接口名称**：`stock_basic`
- **用途**：获取股票列表、基本信息
- **示例**：
  ```
  curl -X POST -d '{"api_name": "stock_basic", "token": "你的token", "params": {"list_status":"L"}, "fields": "ts_code,name,area,industry,list_date"}' http://api.tushare.pro
  ```

### 2. 财务数据

#### 利润表
- **接口名称**：`income`
- **用途**：获取上市公司财务利润表数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "income", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20211231"}, "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,basic_eps,diluted_eps,total_revenue,revenue,int_income,n_interest_income,n_commis_income,n_oth_income"}' http://api.tushare.pro
  ```

#### 资产负债表
- **接口名称**：`balancesheet`
- **用途**：获取上市公司资产负债表数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "balancesheet", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20211231"}, "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,comp_type,total_assets,total_liab,total_hldr_eqy_exc_min_int"}' http://api.tushare.pro
  ```

#### 现金流量表
- **接口名称**：`cashflow`
- **用途**：获取上市公司现金流量表数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "cashflow", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20211231"}, "fields": "ts_code,ann_date,f_ann_date,end_date,report_type,net_profit,finan_exp,c_fr_oper_a,n_cashflow_act,c_paid_goods_s"}' http://api.tushare.pro
  ```

#### 财务指标数据
- **接口名称**：`fina_indicator`
- **用途**：获取财务指标数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "fina_indicator", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20211231"}, "fields": "ts_code,ann_date,eps,dt_eps,total_revenue_ps,revenue_ps,capital_rese_ps,surplus_rese_ps,undist_profit_ps,extra_item,profit_dedt,gross_margin,current_ratio,quick_ratio,cash_ratio,ar_turn,ca_turn,fa_turn,assets_turn,op_income,ebit,ebitda,fcff,fcfe,current_exint,noncurrent_exint"}' http://api.tushare.pro
  ```

#### 业绩预告
- **接口名称**：`forecast`
- **用途**：获取业绩预告数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "forecast", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20220331"}, "fields": "ts_code,ann_date,type,p_change_min,p_change_max,net_profit_min,net_profit_max,last_parent_net,first_ann_date,summary,change_reason"}' http://api.tushare.pro
  ```

#### 业绩快报
- **接口名称**：`express`
- **用途**：获取业绩快报数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "express", "token": "你的token", "params": {"ts_code":"000001.SZ", "period":"20220331"}, "fields": "ts_code,ann_date,end_date,revenue,operate_profit,total_profit,n_income,total_assets,total_hldr_eqy_exc_min_int,diluted_eps,diluted_roe,yoy_net_profit,bps,yoy_sales,yoy_op,yoy_tp,yoy_dedu_np,yoy_eps,yoy_roe"}' http://api.tushare.pro
  ```

### 3. 行情数据

#### 日线行情
- **接口名称**：`daily`
- **用途**：获取股票日线行情
- **示例**：
  ```
  curl -X POST -d '{"api_name": "daily", "token": "你的token", "params": {"ts_code":"000001.SZ", "start_date":"20220101", "end_date":"20220430"}, "fields": "ts_code,trade_date,open,high,low,close,vol,amount"}' http://api.tushare.pro
  ```

#### 复权因子
- **接口名称**：`adj_factor`
- **用途**：获取复权因子，用于计算真实历史价格
- **示例**：
  ```
  curl -X POST -d '{"api_name": "adj_factor", "token": "你的token", "params": {"ts_code":"000001.SZ", "start_date":"20220101", "end_date":"20220430"}, "fields": "ts_code,trade_date,adj_factor"}' http://api.tushare.pro
  ```

#### 停复牌信息
- **接口名称**：`suspend`
- **用途**：获取股票停复牌信息
- **示例**：
  ```
  curl -X POST -d '{"api_name": "suspend", "token": "你的token", "params": {"ts_code":"000001.SZ", "start_date":"20220101", "end_date":"20220430"}, "fields": "ts_code,suspend_date,resume_date,ann_date,suspend_reason,reason_type"}' http://api.tushare.pro
  ```

#### 资金流向
- **接口名称**：`moneyflow`
- **用途**：获取股票资金流向
- **示例**：
  ```
  curl -X POST -d '{"api_name": "moneyflow", "token": "你的token", "params": {"ts_code":"000001.SZ", "start_date":"20220101", "end_date":"20220430"}, "fields": "ts_code,trade_date,buy_sm_vol,buy_sm_amount,sell_sm_vol,sell_sm_amount,buy_md_vol,buy_md_amount,sell_md_vol,sell_md_amount,buy_lg_vol,buy_lg_amount,sell_lg_vol,sell_lg_amount,buy_elg_vol,buy_elg_amount,sell_elg_vol,sell_elg_amount,net_mf_vol,net_mf_amount"}' http://api.tushare.pro
  ```

### 4. 行业和宏观数据

#### 行业分类
- **接口名称**：`index_classify`
- **用途**：获取行业分类数据
- **示例**：
  ```
  curl -X POST -d '{"api_name": "index_classify", "token": "你的token", "params": {"level":"L1", "src":"SW"}, "fields": "index_code,industry_name,level,is_pub,parent_code"}' http://api.tushare.pro
  ```

#### 宏观经济指标
- **接口名称**：`eco_cal`
- **用途**：获取宏观经济日历
- **示例**：
  ```
  curl -X POST -d '{"api_name": "eco_cal", "token": "你的token", "params": {"start_date":"20220101", "end_date":"20220430"}, "fields": "date,time,code,name,p_date,value,preset,previous"}' http://api.tushare.pro
  ```


## 注意事项

1. **接口权限与积分**：Tushare Pro 的接口调用受积分限制，不同接口消耗的积分不同。请确保账户有足够的积分。

2. **数据时效性**：不同数据的更新频率不同，使用前请查阅官方文档了解数据更新时间。

3. **请求频率限制**：短时间内大量请求可能会被限流，建议适当控制请求频率。

4. **数据缓存策略**：对于不经常变化的数据（如股票基础信息），建议实施缓存策略，减少 API 调用次数。

5. **错误处理**：实现适当的错误处理机制，对 API 返回的错误码进行处理，特别是针对权限不足、参数错误等常见问题。

## 参考资源

- [Tushare Pro 官方网站](https://tushare.pro/)
- [Tushare Pro 文档中心](https://tushare.pro/document/1)
- [Tushare GitHub 仓库](https://github.com/waditu/tushare)

---

本文档仅提供 Tushare API 集成的基本指南，具体接口参数和返回字段可能随官方更新而变化，请以 Tushare 官方文档为准。 
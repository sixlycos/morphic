// 基础Tushare工具接口
export interface TushareToolBase {
  id: string // 工具唯一ID
  name: string // 工具名称
  description: string // 工具描述
  apiName: string // Tushare API名称
  requiredParams: string[] // 必需参数
  optionalParams?: string[] // 可选参数
}

// 研报生成所需的Tushare工具集合
export const researchReportTools: TushareToolBase[] = [
  {
    id: 'stock_basic',
    name: '股票基本信息',
    description: '获取基础股票列表数据',
    apiName: 'stock_basic',
    requiredParams: [],
    optionalParams: ['exchange', 'list_status']
  },
  {
    id: 'income',
    name: '利润表',
    description: '获取上市公司财务利润表数据',
    apiName: 'income',
    requiredParams: ['ts_code', 'period'],
    optionalParams: ['report_type', 'comp_type']
  },
  {
    id: 'balancesheet',
    name: '资产负债表',
    description: '获取上市公司资产负债表数据',
    apiName: 'balancesheet',
    requiredParams: ['ts_code', 'period'],
    optionalParams: ['report_type', 'comp_type']
  },
  {
    id: 'cashflow',
    name: '现金流量表',
    description: '获取上市公司现金流量表数据',
    apiName: 'cashflow',
    requiredParams: ['ts_code', 'period'],
    optionalParams: ['report_type', 'comp_type']
  },
  {
    id: 'fina_indicator',
    name: '财务指标',
    description: '获取财务指标数据',
    apiName: 'fina_indicator',
    requiredParams: ['ts_code', 'period'],
    optionalParams: ['start_date', 'end_date']
  },
  {
    id: 'daily',
    name: '日线行情',
    description: '获取股票日线数据',
    apiName: 'daily',
    requiredParams: ['ts_code'],
    optionalParams: ['trade_date', 'start_date', 'end_date']
  }
]

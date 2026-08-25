import * as XLSX from 'xlsx';
import { downloadBlob } from '@/utils/download';

/**
 * 与系统解析逻辑完全一致的「导入模板」定义。
 * 表头与字段顺序来自真实导出模板（正常/临期仓库存、未分拣、EOP 库存/赠品），
 * 便于用户下载后按相同结构填写再导入。
 */
export interface ImportTemplate {
  key: string;
  label: string;
  source: 'eop' | 'wms' | 'gift';
  warehouse?: 'normal' | 'expired';
  description: string;
  headers: string[];
  exampleRows: Record<string, unknown>[];
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    key: 'eop_stock',
    label: 'EOP 库存',
    source: 'eop',
    description: '电商库存快照：库存数量 / 退货数量 / 实际库存数量。导入时选择仓库类型。',
    headers: [
      '行号', '商品编码', '商品条码', '中文名称', '中文名称-全称', '英文名称',
      '商品规格', '规格-全称', '商品新分类', '品牌', '库存数量', '退货数量',
      '实际库存数量', '门店', '店面', '柜组', '大类', '供应商', '经营方式',
      '厂商货号', '厂商货号-全称', '类别', '是否样品', '平均含税进价',
      '平均不含税进价', '库存含税进价金额', '库存不含税进价金额', '售价',
      '售价金额', '适用季节', '花色', '尺码', '款式', '内部季节', 'SKC精品', 'SPU精品',
    ],
    exampleRows: [
      {
        行号: 1, 商品编码: 'A000036', 商品条码: '3219820000368',
        中文名称: '马爹利蓝带干邑公升装', '中文名称-全称': '马爹利蓝带干邑公升装',
        英文名称: 'MARTELL CORDON BLEU', 商品规格: '1x12x1L', '规格-全称': '1x12x1L',
        商品新分类: '[010102]免税进口酒', 品牌: '[010012]MARTELL 马爹利',
        库存数量: 0, 退货数量: 0, 实际库存数量: 0, 门店: '[7018]海南电商离岛免税',
        店面: '[701804]三亚预订仓', 柜组: '[70180401]三亚预定售卖仓', 大类: '[01]进口酒',
        供应商: '[0002]中免国际有限公司', 经营方式: '经销', 厂商货号: '100429358',
        '厂商货号-全称': '100429358', 类别: '[010101]干邑', 是否样品: '否',
        平均含税进价: 664.65, 平均不含税进价: 664.65, 库存含税进价金额: 0,
        库存不含税进价金额: 0, 售价: 1905, 售价金额: 0, 适用季节: '干邑',
        花色: '', 尺码: '', 款式: '', 内部季节: '', SKC精品: '', SPU精品: '',
      },
    ],
  },
  {
    key: 'eop_gift',
    label: 'EOP 赠品库存',
    source: 'eop',
    description: '赠品库存快照（同 EOP 结构，含库存/退货/实际）。导入时勾选「标记为赠品」。',
    headers: [
      '序号', '商品编码', '商品条码', '中文名称', '英文名称', '规格', '商品新分类',
      '品牌', '库存数量', '退货数量', '实际库存数量', '门店', '店面', '柜组', '大类',
      '供应商', '经营方式', '厂商货号', '类别', '是否样品', '平均含税进价',
      '平均不含税进价', '库存含税进价金额', '库存不含税进价金额', '售价', '售价金额',
      '适用季节', '花色', '尺码', '款式',
    ],
    exampleRows: [
      {
        序号: 1, 商品编码: 'GZ0023803', 商品条码: '20221210003', 中文名称: '希思黎花盒',
        英文名称: '', 规格: '', 商品新分类: '[010105]免税香化', 品牌: '[030048]Sisley 希思黎',
        库存数量: 0, 退货数量: 0, 实际库存数量: 0, 门店: '[7018]海南电商离岛免税',
        店面: '[701804]三亚预订仓', 柜组: '[70180410]三亚预定赠品仓', 大类: '[26]免值品',
        供应商: '[70180001]海南智科国内免值品（有税）', 经营方式: '经销', 厂商货号: '',
        类别: '[260204]套装', 是否样品: '否', 平均含税进价: 0, 平均不含税进价: 0,
        库存含税进价金额: 0, 库存不含税进价金额: 0, 售价: 0, 售价金额: 0,
        适用季节: '', 花色: '', 尺码: '', 款式: '其他赠品',
      },
    ],
  },
  {
    key: 'wms_normal_stock',
    label: '正常仓库存',
    source: 'wms',
    warehouse: 'normal',
    description: 'WMS 正常仓库存快照：onHandQty 对应总库存。导入时仓库类型选「正常仓」。',
    headers: [
      'companyCode', 'itemCode', 'name', 'locationCode', 'zoneCode', 'onHandQty',
      'inTransitQty', 'allocatedQty', 'lockedQty', 'frozenQty', 'lot',
      'manufactureDate', 'expirationDate', 'agingDate', 'attribute1', 'inventorySts',
      'lpn', 'shelfLifeSts',
    ],
    exampleRows: [
      {
        companyCode: 'HNZM', itemCode: 'YZ0069368', name: '莱珀妮-SPA券',
        locationCode: 'A02-0222-1701-41', zoneCode: 'PK', onHandQty: 7,
        inTransitQty: 0, allocatedQty: 0, lockedQty: 0, frozenQty: 0,
        lot: '', manufactureDate: '', expirationDate: '2099-01-01', agingDate: '',
        attribute1: 'D', inventorySts: 'ZSP', lpn: '', shelfLifeSts: '',
      },
      {
        companyCode: 'HNZM', itemCode: 'YZ0069367', name: '雅诗兰黛-SPA券',
        locationCode: 'A02-0222-1701-41', zoneCode: 'PK', onHandQty: 111,
        inTransitQty: 0, allocatedQty: 0, lockedQty: 0, frozenQty: 0,
        lot: '', manufactureDate: '', expirationDate: '2099-01-01', agingDate: '',
        attribute1: 'D', inventorySts: 'ZSP', lpn: '', shelfLifeSts: '',
      },
    ],
  },
  {
    key: 'wms_expired_stock',
    label: '临期仓库存',
    source: 'wms',
    warehouse: 'expired',
    description: 'WMS 临期仓库存快照。导入时仓库类型选「临期仓」。',
    headers: [
      'companyCode', 'itemCode', 'name', 'locationCode', 'zoneCode', 'onHandQty',
      'inTransitQty', 'allocatedQty', 'lockedQty', 'frozenQty', 'lot',
      'manufactureDate', 'expirationDate', 'agingDate', 'attribute1', 'inventorySts',
      'lpn', 'shelfLifeSts',
    ],
    exampleRows: [
      {
        companyCode: 'HNZM', itemCode: 'C117190', name: 'PAT MCGRATH LABS丝缎唇膏497',
        locationCode: 'A02-0221-0329-47', zoneCode: 'JCKQ', onHandQty: 5,
        inTransitQty: 0, allocatedQty: 0, lockedQty: 0, frozenQty: 0,
        lot: '', manufactureDate: '', expirationDate: '2026-10-01', agingDate: '',
        attribute1: '', inventorySts: 'ZP', lpn: '', shelfLifeSts: '',
      },
    ],
  },
  {
    key: 'wms_normal_unsorted',
    label: '正常仓未分拣',
    source: 'wms',
    warehouse: 'normal',
    description: 'WMS 正常仓未分拣出库单行（按货品编码聚合为未分拣量）。导入时仓库类型选「正常仓」。',
    headers: [
      '出库单号', '出库单类型', '承运人编码', '快递单号', '波次号', '货品编码',
      '货品名称', '数量', '收件人', '省', '市', '区', '地址', '身份证号', '失败原因', '创建时间',
    ],
    exampleRows: [
      {
        出库单号: '2608307661', 出库单类型: '1', 承运人编码: 'SF', 快递单号: '',
        波次号: 0, 货品编码: 'C118395', 货品名称: '普拉达原光新肌轻垫粉底液 LC5 替换芯',
        数量: 1, 收件人: '', 省: '辽宁省', 市: '沈阳市', 区: '沈河区', 地址: '',
        身份证号: '', 失败原因: '', 创建时间: '2026-04-28T10:12',
      },
    ],
  },
  {
    key: 'wms_expired_unsorted',
    label: '临期仓未分拣',
    source: 'wms',
    warehouse: 'expired',
    description: 'WMS 临期仓未分拣出库单行。导入时仓库类型选「临期仓」。',
    headers: [
      '出库单号', '出库单类型', '承运人编码', '快递单号', '波次号', '货品编码',
      '货品名称', '数量', '收件人', '省', '市', '区', '地址', '身份证号', '失败原因', '创建时间',
    ],
    exampleRows: [
      {
        出库单号: '2603804424', 出库单类型: '1', 承运人编码: '', 快递单号: '',
        波次号: 1446560, 货品编码: 'C115535', 货品名称: 'Maison 21G随行香水笔（爵士茉莉5ml+佛手柑之鸣5ml） 5ml*2',
        数量: 1, 收件人: '', 省: '', 市: '', 区: '', 地址: '', 身份证号: '', 失败原因: '',
        创建时间: '2026-01-01T14:06',
      },
    ],
  },
];

/** 生成并下载某个模板（表头 + 示例行）。 */
export function downloadTemplate(t: ImportTemplate): void {
  const ws = XLSX.utils.json_to_sheet(t.exampleRows, { header: t.headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'template');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${t.label}.xlsx`);
}

/** 商品主档导入模板（商品编码必填，中文名称/商品条码可选）。 */
export function downloadProductTemplate(): void {
  const headers = ['商品编码', '中文名称', '商品条码'];
  const exampleRows = [
    { 商品编码: 'A000036', 中文名称: '马爹利蓝带干邑公升装', 商品条码: '3219820000368' },
    { 商品编码: 'C115535', 中文名称: 'Maison 21G随行香水笔', 商品条码: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(exampleRows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'template');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, '商品主档导入模板.xlsx');
}

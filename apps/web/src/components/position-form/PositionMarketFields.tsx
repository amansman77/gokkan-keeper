import { POSITION_ASSET_TYPES, POSITION_MARKETS } from '@gokkan-keeper/shared';
import type { Dispatch, SetStateAction } from 'react';
import type { CreatePosition } from '../../lib/types';
interface FieldProps { formData: CreatePosition; setFormData: Dispatch<SetStateAction<CreatePosition>>; }
export function PositionMarketFields({ formData, setFormData }: FieldProps) {
  const hasCustomMarket = !!formData.market && !POSITION_MARKETS.some(market => market === formData.market);
  const hasCustomAssetType = !!formData.assetType && !POSITION_ASSET_TYPES.some(assetType => assetType === formData.assetType);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="market" className="gk-label">시장(선택)</label>
        <select
          id="market"
          value={formData.market || ''}
          onChange={(e) => setFormData({ ...formData, market: e.target.value || null })}
          className="gk-input"
        >
          <option value="">선택 안 함</option>
          {POSITION_MARKETS.map((market) => (
            <option key={market} value={market}>
              {market}
            </option>
          ))}
          {hasCustomMarket && <option value={formData.market || ''}>{formData.market}</option>}
        </select>
      </div>
      <div>
        <label htmlFor="assetType" className="gk-label">자산유형(선택)</label>
        <select
          id="assetType"
          value={formData.assetType || ''}
          onChange={(e) => setFormData({ ...formData, assetType: e.target.value || null })}
          className="gk-input"
        >
          <option value="">선택 안 함</option>
          {POSITION_ASSET_TYPES.map((assetType) => (
            <option key={assetType} value={assetType}>
              {assetType}
            </option>
          ))}
          {hasCustomAssetType && <option value={formData.assetType || ''}>{formData.assetType}</option>}
        </select>
      </div>
    </div>
  );
}

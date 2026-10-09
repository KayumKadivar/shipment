import React from 'react';
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import { useAppSelector } from '../app/hooks';
const CountrySelect: React.FC<SelectProps> = ({ className, popupClassName, ...props }) => {
  const countries = useAppSelector(state => state.app.countries || []);

  return (
    <Select
      {...props}
      className={['quote-country-select', className].filter(Boolean).join(' ')}
      popupClassName={['quote-country-dropdown', popupClassName].filter(Boolean).join(' ')}
      loading={props.loading || (countries.length === 0)}
      options={countries.map((c) => ({
        label: c.countryName,
        value: c.countryCode,
      }))}
      showSearch
      optionFilterProp="label"
    />
  );
};

export default CountrySelect;

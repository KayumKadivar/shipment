import React from 'react';
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import { useAppSelector } from '../app/hooks';

interface Country {
  countryId: number;
  countryCode: string;
  countryName: string;
}

const CountrySelect: React.FC<SelectProps> = (props) => {
  const countries = useAppSelector(state => state.app.countries || []);

  return (
    <Select
      {...props}
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

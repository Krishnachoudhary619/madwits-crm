"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api/endpoints";
import type { AttributionOption } from "@/types/api";
import { Field, Select } from "@/components/ui";

const STORAGE_KEY = "mw_attribution_user_id";

export function AttributionSelect({
  value,
  onChange,
  label = "Attribute this update to",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [options, setOptions] = useState<AttributionOption[]>([]);

  useEffect(() => {
    void usersApi.attribution().then((items) => {
      setOptions(items);
      if (!value) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const match = items.find((item) => item.id === stored);
        onChange(match?.id ?? items[0]?.id ?? "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field
      label={label}
      hint="This records who is credited on the job history. It is not the signed-in operator and does not grant extra permissions."
    >
      <Select
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          window.localStorage.setItem(STORAGE_KEY, event.target.value);
        }}
      >
        <option value="">Select person</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.display_name} ({option.username})
          </option>
        ))}
      </Select>
    </Field>
  );
}

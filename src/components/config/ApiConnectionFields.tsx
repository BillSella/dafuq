import { LabelFieldRow } from "../ui/LabelFieldRow";

type ApiConnectionFieldsProps = {
  endpointUrl: string;
  endpointPlaceholder?: string;
  updateGroup: string;
  updateGroupPlaceholder?: string;
  updateGroupOptions?: string[];
  updateGroupListId?: string;
  onEndpointUrlChange: (value: string) => void;
  onUpdateGroupChange: (value: string) => void;
};

export function ApiConnectionFields(props: ApiConnectionFieldsProps) {
  const listId = props.updateGroupListId ?? "widget-update-group-options";
  const hasOptions = (props.updateGroupOptions?.length ?? 0) > 0;

  return (
    <>
      <LabelFieldRow label="Endpoint URL" class="endpoint-subfield">
        <input
          type="text"
          value={props.endpointUrl}
          placeholder={props.endpointPlaceholder ?? "https://api.foo.com/..."}
          list={hasOptions ? listId : undefined}
          onInput={(event) => props.onEndpointUrlChange(event.currentTarget.value)}
        />
      </LabelFieldRow>
      <LabelFieldRow label="Update Group" class="endpoint-subfield">
        <input
          type="text"
          value={props.updateGroup}
          placeholder={props.updateGroupPlaceholder ?? "Optional Data Synchronization Group Name"}
          list={hasOptions ? listId : undefined}
          onInput={(event) => props.onUpdateGroupChange(event.currentTarget.value)}
        />
        {hasOptions && (
          <datalist id={listId}>
            {props.updateGroupOptions!.map((group) => (
              <option value={group} />
            ))}
          </datalist>
        )}
      </LabelFieldRow>
    </>
  );
}

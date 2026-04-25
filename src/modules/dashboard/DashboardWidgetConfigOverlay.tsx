import type { Accessor, JSX } from "solid-js";
import { BarSettingsForm } from "../../components/config/BarSettingsForm";
import { DonutSettingsForm } from "../../components/config/DonutSettingsForm";
import { LabelSettingsForm } from "../../components/config/LabelSettingsForm";
import { MapSettingsForm } from "../../components/config/MapSettingsForm";
import { NumberGaugeSettingsForm } from "../../components/config/NumberGaugeSettingsForm";
import { SparklineSettingsForm } from "../../components/config/SparklineSettingsForm";
import { TimeSeriesSettingsForm } from "../../components/config/TimeSeriesSettingsForm";
import { WidgetConfigOverlayShell } from "../../components/config/WidgetConfigOverlayShell";
import type {
  CommonWidgetSettingsPatch,
  WidgetConfigMap,
  WidgetStateByType,
  WidgetType
} from "../../widgets/widgetRegistry";
import type { DashboardWidget, SlideDirection } from "./dashboardEditorConstants";

export type DashboardWidgetConfigOverlayProps = {
  panelRef: (el: HTMLDivElement | undefined) => void;
  open: Accessor<boolean>;
  slideDirection: Accessor<SlideDirection>;
  panelTop: Accessor<number>;
  panelLeft: Accessor<number>;
  width: Accessor<number>;
  height: Accessor<number>;
  activeWidget: Accessor<DashboardWidget | undefined>;
  activeGaugeWidget: Accessor<WidgetStateByType<"numberGauge"> | undefined>;
  activeLabelWidget: Accessor<WidgetStateByType<"label"> | undefined>;
  activeDonutWidget: Accessor<WidgetStateByType<"donutChart"> | undefined>;
  activeSparklineWidget: Accessor<WidgetStateByType<"sparklineChart"> | undefined>;
  activeTimeSeriesWidget: Accessor<WidgetStateByType<"timeSeriesChart"> | undefined>;
  activeMapWidget: Accessor<WidgetStateByType<"mapNetwork"> | undefined>;
  activeBarWidget: Accessor<WidgetStateByType<"barChart"> | undefined>;
  dashboardUpdateGroups: Accessor<string[]>;
  renderBaseWidgetSettings: (labelField: "label" | "staticText") => JSX.Element;
  configWidgetId: Accessor<string | null>;
  updateWidgetConfig: (
    id: string,
    patch: Partial<WidgetConfigMap[WidgetType]> | CommonWidgetSettingsPatch
  ) => void;
};

/**
 * Slide-in widget configuration panel and per-type settings forms.
 */
export function DashboardWidgetConfigOverlay(props: DashboardWidgetConfigOverlayProps) {
  return (
    <WidgetConfigOverlayShell
      panelRef={props.panelRef}
      open={props.open()}
      slideDirection={props.slideDirection()}
      top={props.panelTop()}
      left={props.panelLeft()}
      width={props.width()}
      height={props.height()}
    >
      {props.activeWidget()?.type === "numberGauge" ? (
        <NumberGaugeSettingsForm
          config={
            props.activeGaugeWidget()?.config ?? {
              label: "Primary Sensor",
              fontSize: "medium",
              align: "center",
              apiEndpoint: "",
              field: "",
              defaultValue: "72",
              decimalPlaces: 1,
              format: "full",
              updateGroup: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : props.activeWidget()?.type === "label" ? (
        <LabelSettingsForm
          config={
            props.activeLabelWidget()?.config ?? {
              sourceMode: "static",
              align: "center",
              staticText: "Label Text",
              apiEndpoint: "",
              field: "",
              fallbackText: "No Data",
              updateGroup: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("staticText")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : props.activeWidget()?.type === "donutChart" ? (
        <DonutSettingsForm
          config={
            props.activeDonutWidget()?.config ?? {
              label: "Utilization",
              align: "center",
              ringWidth: 13,
              min: 0,
              max: 100,
              decimals: 1,
              format: "compact",
              defaultValue: "",
              seriesLabelField: "label",
              seriesValueField: "value",
              updateGroup: "",
              apiEndpoint: "",
              field: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : props.activeWidget()?.type === "sparklineChart" ? (
        <SparklineSettingsForm
          config={
            props.activeSparklineWidget()?.config ?? {
              label: "Latency",
              align: "left",
              min: 0,
              max: 100,
              format: "compact",
              decimals: 1,
              defaultValue: "",
              seriesLabelField: "label",
              seriesValueField: "value",
              strokeWidth: 2.5,
              showFill: true,
              updateGroup: "",
              apiEndpoint: "",
              field: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : props.activeWidget()?.type === "timeSeriesChart" ? (
        <TimeSeriesSettingsForm
          config={
            props.activeTimeSeriesWidget()?.config ?? {
              label: "Requests / min",
              align: "left",
              min: 0,
              max: 12,
              format: "compact",
              decimals: 1,
              defaultValue: "",
              seriesLabelField: "t",
              seriesValueField: "a",
              seriesValueFields: "a, b",
              strokeWidth: 2.2,
              showFill: true,
              showGrid: true,
              stacked: false,
              updateGroup: "",
              apiEndpoint: "",
              field: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : props.activeWidget()?.type === "mapNetwork" ? (
        <MapSettingsForm
          config={
            props.activeMapWidget()?.config ?? {
              label: "Map",
              align: "left",
              mapRegion: "world",
              min: 0,
              max: 1000,
              dotRadiusMin: 2.2,
              dotRadiusMax: 9.5,
              format: "compact",
              decimals: 0,
              lineBend: 0.14,
              defaultValue: "",
              updateGroup: "",
              apiEndpoint: "",
              field: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      ) : (
        <BarSettingsForm
          config={
            props.activeBarWidget()?.config ?? {
              label: "Throughput",
              align: "left",
              orientation: "horizontal",
              min: 0,
              max: 100,
              format: "compact",
              decimals: 1,
              defaultValue: "",
              seriesLabelField: "label",
              seriesValueField: "value",
              updateGroup: "",
              apiEndpoint: "",
              field: ""
            }
          }
          dashboardUpdateGroups={props.dashboardUpdateGroups()}
          baseSettings={props.renderBaseWidgetSettings("label")}
          onPatch={(patch) => {
            const id = props.configWidgetId();
            if (!id) return;
            props.updateWidgetConfig(id, patch);
          }}
        />
      )}
    </WidgetConfigOverlayShell>
  );
}

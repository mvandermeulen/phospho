"use client";

import { authFetcher } from "@/lib/fetcher";
import { navigationStateStore } from "@/store/store";
import { useUser } from "@propelauth/nextjs/client";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import useSWRImmutable from "swr/immutable";

import { PivotTableElement } from "./dataviz";

const DatavizTaggerGraph = ({
  tagger_name,
  metric,
  metadata_metric,
  breakdown_by,
  scorer_id,
}: {
  tagger_name: string;
  metric: string;
  metadata_metric?: string | null;
  breakdown_by: string;
  scorer_id: string | null;
}) => {
  const { accessToken } = useUser();

  const project_id = navigationStateStore((state) => state.project_id);
  const dataFilters = navigationStateStore((state) => state.dataFilters);

  const mergedFilters = {
    ...dataFilters,
    event_name: dataFilters.event_name
      ? [...dataFilters.event_name, tagger_name]
      : [tagger_name],
  };

  const { data: pivotData } = useSWRImmutable(
    [
      `/api/metadata/${project_id}/pivot/`,
      accessToken,
      metric,
      metadata_metric,
      breakdown_by,
      scorer_id,
      JSON.stringify(mergedFilters),
    ],
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metric: metric.toLowerCase(),
        metric_metadata: metadata_metric?.toLowerCase(),
        breakdown_by:
          breakdown_by !== "None" ? breakdown_by.toLowerCase() : null,
        scorer_id: scorer_id,
        filters: mergedFilters,
      }).then((response) => {
        const pivotTable = response?.pivot_table as PivotTableElement[] | null;
        if (!pivotTable) {
          return [];
        }
        // Replace "breakdown_by": null with "breakdown_by": "None"
        pivotTable.forEach((element: PivotTableElement) => {
          if (element.breakdown_by === null) {
            element.breakdown_by = "None";
          }
        });

        return pivotTable;
      }),
    {
      keepPreviousData: false,
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnReconnect: true,
      revalidateOnFocus: false,
      revalidateOnMount: true,
      refreshWhenOffline: false,
    },
  );

  // I want to get the value of the metric that is the highest in the pivotData
  let maxValue = 0;
  pivotData?.forEach((element: PivotTableElement) => {
    if (
      element.metric !== null &&
      typeof element.metric === "number" &&
      element.metric > maxValue
    ) {
      maxValue = element.metric;
    }
  });

  return (
    <div className="w-[200px]">
      <ResponsiveContainer width={"100%"} height={150}>
        <BarChart
          data={pivotData}
          layout={"vertical"} // this actually displays the bar horizontally
          margin={{
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        >
          <Bar dataKey={"metric"} fill="#22c55e" stackId="b" barSize={6}>
            <LabelList
              dataKey="metric"
              position="right"
              formatter={(value: number) =>
                `${Math.floor((100 * value) / maxValue)}%`
              }
              style={{ fill: "#666666" }}
              fontSize={12}
            />
          </Bar>
          <YAxis
            dataKey={"breakdown_by"}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            type="category"
            tickFormatter={(value: string) => {
              // if value is a string and is too long, truncate it
              if (value.length > 30) {
                return value.slice(0, 30) + "...";
              }
              return value;
            }}
            width={80}
          />
          <XAxis
            fontSize={12}
            type="number"
            domain={[0, "dataMax + 12"]}
            tickLine={false}
            axisLine={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DatavizTaggerGraph;

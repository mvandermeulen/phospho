import { SendDataAlertDialog } from "@/components/callouts/import-data";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetcher } from "@/lib/fetcher";
import { graphColors } from "@/lib/utils";
import { ProjectDataFilters } from "@/models/models";
import { navigationStateStore } from "@/store/store";
import { useUser } from "@propelauth/nextjs/client";
import { AlertDialog } from "@radix-ui/react-alert-dialog";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Label,
  Pie,
  PieChart,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import useSWR from "swr";

interface NbSessions {
  day: string;
  date: string;
  nb_sessions: number;
}

interface LastClusteringComposition {
  name: string;
  description: string;
  size: number;
}

interface EventsRanking {
  event_name: string;
  nb_events: number;
}

const chartConfig: ChartConfig = {};

interface SessionsDatavizProps {
  forcedDataFilters?: ProjectDataFilters | null;
}

const SessionsDataviz: React.FC<SessionsDatavizProps> = ({
  forcedDataFilters,
}) => {
  /*
  Note: This is not displayed if there are no tasks in the project.
   */
  const { accessToken } = useUser();

  const project_id = navigationStateStore((state) => state.project_id);
  const dataFilters = navigationStateStore((state) => state.dataFilters);
  const mergedDataFilters = {
    ...dataFilters,
    ...forcedDataFilters,
  };

  const [open, setOpen] = React.useState(false);

  const { data: totalNbSessions } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/aggregated/sessions`,
          accessToken,
          "total_nb_sessions",
          JSON.stringify(mergedDataFilters),
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metrics: ["total_nb_sessions"],
        filters: mergedDataFilters,
      }).then((data) => {
        if (data === undefined) return undefined;
        if (!data?.total_nb_sessions) return null;
        return data.total_nb_sessions;
      }),
    {
      keepPreviousData: true,
    },
  );

  const {
    data: nbSessionsPerDay,
  }: {
    data: NbSessions[] | undefined;
  } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/aggregated/sessions`,
          accessToken,
          "nb_sessions_per_day",
          JSON.stringify(mergedDataFilters),
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metrics: ["nb_sessions_per_day"],
        filters: mergedDataFilters,
      }).then((data) => {
        if (data === undefined) {
          return undefined;
        }
        if (!data.nb_sessions_per_day) {
          return null;
        }
        return data.nb_sessions_per_day?.map((element: NbSessions) => {
          const date = new Date(element.date);
          const date_array = date.toDateString().split(" ");
          const day = date_array[1] + " " + date_array[2];
          element.day = day;
          return element;
        });
      }),
    {
      keepPreviousData: true,
    },
  );

  const {
    data: lastClusteringComposition,
  }: { data: LastClusteringComposition[] | null | undefined } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/aggregated/tasks`,
          accessToken,
          "last_clustering_composition",
          JSON.stringify(mergedDataFilters),
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metrics: ["last_clustering_composition"],
        filters: mergedDataFilters,
      }).then((data) => {
        if (data === undefined) {
          return undefined;
        }
        if (!data?.last_clustering_composition) {
          return null;
        }
        data?.last_clustering_composition?.sort(
          (a: LastClusteringComposition, b: LastClusteringComposition) =>
            b.size - a.size,
        );
        data?.last_clustering_composition?.forEach(
          (clustering: { fill: string }, index: number) => {
            clustering.fill = graphColors[index % graphColors.length];
          },
        );
        return data?.last_clustering_composition;
      }),
    {
      keepPreviousData: true,
    },
  );

  const { data: dateLastClustering } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/aggregated/tasks`,
          accessToken,
          "date_last_clustering_timestamp",
          JSON.stringify(mergedDataFilters),
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metrics: ["date_last_clustering_timestamp"],
        filters: mergedDataFilters,
      }).then((data) => {
        if (data === undefined) {
          return undefined;
        }
        if (!data?.date_last_clustering_timestamp) {
          return null;
        }
        const date_last_clustering = new Date(
          data?.date_last_clustering_timestamp * 1000,
        );
        return date_last_clustering.toDateString();
      }),
    {
      keepPreviousData: true,
    },
  );

  const { data: mostDetectedEvent } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/aggregated/tasks`,
          accessToken,
          "most_detected_event",
          JSON.stringify(mergedDataFilters),
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        metrics: ["most_detected_event"],
        filters: mergedDataFilters,
      }).then((data) => {
        if (data === undefined) {
          return undefined;
        }
        if (!data?.most_detected_event) {
          return null;
        }
        return data?.most_detected_event;
      }),
    {
      keepPreviousData: true,
    },
  );

  const { data: eventsRanking }: { data: EventsRanking[] | null | undefined } =
    useSWR(
      project_id
        ? [
            `/api/explore/${project_id}/aggregated/tasks`,
            accessToken,
            "events_ranking",
            JSON.stringify(mergedDataFilters),
          ]
        : null,
      ([url, accessToken]) =>
        authFetcher(url, accessToken, "POST", {
          metrics: ["events_ranking"],
          filters: mergedDataFilters,
        }).then((data) => {
          if (data === undefined) {
            return undefined;
          }
          if (!data?.events_ranking || data?.events_ranking.length === 0) {
            return null;
          }
          data?.events_ranking?.sort(
            (a: EventsRanking, b: EventsRanking) => b.nb_events - a.nb_events,
          );
          data?.events_ranking?.forEach(
            (event: { fill: string }, index: number) => {
              event.fill = graphColors[index % graphColors.length];
            },
          );
          return data?.events_ranking;
        }),
      {
        keepPreviousData: true,
      },
    );

  const CustomTooltipEvent: React.FC<TooltipProps<ValueType, NameType>> = ({
    active,
    payload,
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary shadow-md p-2 rounded-md">
          <p className="text-secondary font-semibold">{`${payload[0].payload.event_name}`}</p>
          <p className="text-green-500">{`${payload[0].value == 1 ? payload[0].value + " tag detected" : payload[0].value + " tags detected"}`}</p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipClustering: React.FC<
    TooltipProps<ValueType, NameType>
  > = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary shadow-md p-2 rounded-md">
          <p className="text-secondary font-semibold">{`Cluster ${payload[0].name}`}</p>
          <p className="text-secondary">{`Description: ${payload[0].payload.description}`}</p>
          <p className="text-green-500">{`${payload[0].value ? Number(payload[0].value).toFixed(0) : 0} messages in cluster`}</p>
        </div>
      );
    }
  };

  const CustomTooltipNbrSessions: React.FC<
    TooltipProps<ValueType, NameType>
  > = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary shadow-md p-2 rounded-md">
          <p className="text-secondary font-semibold">{label}</p>
          <p className="text-green-500">{`${payload[0].value === 1 ? payload[0].value + " session" : payload[0].value ? Number(payload[0].value).toFixed(0) : "0" + " sessions"}`}</p>
        </div>
      );
    }
    return null;
  };

  const totalClusters = useMemo(() => {
    return lastClusteringComposition?.reduce((acc) => acc + 1, 0) ?? 0;
  }, [lastClusteringComposition]);

  const totalTags = useMemo(() => {
    return eventsRanking?.reduce((acc, curr) => acc + curr.nb_events, 0) ?? 0;
  }, [eventsRanking]);

  const { data: hasTasksData } = useSWR(
    project_id ? [`/api/explore/${project_id}/has-tasks`, accessToken] : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "POST"),
    { keepPreviousData: true },
  );
  const hasTasks: boolean = hasTasksData?.has_tasks ?? false;

  if (!project_id) {
    return <></>;
  }

  if (hasTasks === false) {
    return <></>;
  }

  return (
    <div>
      <AlertDialog open={open}>
        <SendDataAlertDialog setOpen={setOpen} />
      </AlertDialog>
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex-1">
            <h3 className="text-muted-foreground mb-2">
              {totalNbSessions === undefined && (
                <span className="text-2xl font-bold">...</span>
              )}
              {totalNbSessions === null && (
                <span className="text-2xl font-bold">0</span>
              )}
              {totalNbSessions && (
                <span className="text-2xl font-bold">{totalNbSessions}</span>
              )}
              <span className="ml-2">sessions</span>
            </h3>
            {nbSessionsPerDay === null && (
              <div className="flex flex-col text-center items-center py-6">
                <p className="text-muted-foreground mb-2 text-sm">
                  Send data to get started
                </p>
                <Button variant="outline" onClick={() => setOpen(true)}>
                  Import data
                  <ChevronRight className="ml-2" />
                </Button>
              </div>
            )}
            {nbSessionsPerDay === undefined && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <Skeleton className="w-[100%] h-[10rem]" />
              </ChartContainer>
            )}
            {nbSessionsPerDay && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <BarChart data={nbSessionsPerDay} barGap={0} barCategoryGap={0}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <ChartTooltip content={CustomTooltipNbrSessions} />
                  <Bar
                    dataKey="nb_sessions"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-muted-foreground mb-2">
              <span className="mr-2">Last clustering:</span>
              {dateLastClustering === undefined && (
                <span className="text-2xl font-bold">...</span>
              )}
              {dateLastClustering === null && (
                <span className="text-2xl font-bold">Never</span>
              )}
              {dateLastClustering && (
                <span className="text-2xl font-bold">{dateLastClustering}</span>
              )}
            </h3>
            {lastClusteringComposition === null && (
              // Add a button in the center with a CTA "setup session tracking"
              <div className="flex flex-col text-center items-center py-6">
                <p className="text-muted-foreground mb-2 text-sm">
                  Run a clustering on your data
                </p>
                <Link href="/org/insights/clusters">
                  <Button variant="outline">
                    Cluster data
                    <ChevronRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            )}
            {lastClusteringComposition === undefined && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <Skeleton className="w-[100%] h-[10rem]" />
              </ChartContainer>
            )}
            {lastClusteringComposition && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <PieChart className="w-[100%] h-[10rem]">
                  <ChartTooltip content={CustomTooltipClustering} />
                  <Pie
                    data={lastClusteringComposition}
                    dataKey="size"
                    nameKey="name"
                    labelLine={false}
                    innerRadius={60}
                    outerRadius={70}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 5}
                                className="fill-foreground text-3xl font-bold"
                              >
                                {totalClusters.toLocaleString()}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 25}
                                className="fill-muted-foreground"
                              >
                                clusters
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-muted-foreground mb-2">
              <span className="mr-2">Top tag:</span>
              {mostDetectedEvent === undefined && (
                <span className="text-2xl font-bold">...</span>
              )}
              {mostDetectedEvent === null && (
                <span className="text-2xl font-bold">None</span>
              )}
              {mostDetectedEvent && (
                <span className="text-2xl font-bold">{mostDetectedEvent}</span>
              )}
            </h3>
            {eventsRanking === null && (
              // Add a button in the center with a CTA "setup analytics"
              <div className="flex flex-col text-center items-center py-6">
                <p className="text-muted-foreground mb-2 text-sm">
                  Never miss an important conversation
                </p>
                <Link href="/org/insights/events">
                  <Button variant="outline">
                    Setup analytics
                    <ChevronRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            )}
            {eventsRanking === undefined && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <Skeleton className="w-[100%] h-[10rem]" />
              </ChartContainer>
            )}
            {eventsRanking && (
              <ChartContainer
                config={chartConfig}
                className="w-[100%] h-[10rem]"
              >
                <PieChart className="w-[100%] h-[10rem]">
                  <ChartTooltip content={CustomTooltipEvent} />
                  <Pie
                    data={eventsRanking}
                    dataKey="nb_events"
                    nameKey="tagger_name"
                    labelLine={false}
                    innerRadius={60}
                    outerRadius={70}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy || 0 + 5}
                                className="fill-foreground text-3xl font-bold"
                              >
                                {totalTags.toLocaleString()}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 25}
                                className="fill-muted-foreground"
                              >
                                tags
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { SessionsDataviz };

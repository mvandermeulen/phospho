import {
  AddEventDropdownForTasks,
  InteractiveEventBadgeForTasks,
} from "@/components/label-events";
import { EvalSettings } from "@/components/transcripts/settings/eval-settings";
import { RunEventsSettings } from "@/components/transcripts/settings/events-settings";
import { SentimentSettings } from "@/components/transcripts/settings/sentiment-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { authFetcher } from "@/lib/fetcher";
import { formatUnixTimestampToLiteralDatetime } from "@/lib/time";
import { getLanguageLabel } from "@/lib/utils";
import {
  Event,
  EventDefinition,
  Project,
  TaskWithEvents,
} from "@/models/models";
import { navigationStateStore } from "@/store/store";
import { useUser } from "@propelauth/nextjs/client";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  PenSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import useSWR, { KeyedMutator } from "swr";

async function flagTask({
  task_id,
  flag,
  accessToken,
  project_id,
  mutateTasks,
}: {
  task_id: string;
  flag: string;
  accessToken?: string;
  project_id?: string | null;
  mutateTasks: KeyedMutator<any>;
}) {
  if (!accessToken) return;
  if (!project_id) return;

  const creation_response = await fetch(`/api/tasks/${task_id}/human-eval`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      human_eval: flag,
    }),
  });
  mutateTasks((data: any) => {
    // Edit the Task with the same task id
    data.tasks = data.tasks.map((task: TaskWithEvents) => {
      if (task.id === task_id) {
        task.flag = flag;
      }
      return task;
    });
    return data;
  });
}

export function getColumns({
  mutateTasks,
  setSheetOpen,
  setSheetToOpen,
  setEventDefinition,
}: {
  mutateTasks: KeyedMutator<any>;
  setSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSheetToOpen: React.Dispatch<React.SetStateAction<string | null>>;
  setEventDefinition: React.Dispatch<
    React.SetStateAction<EventDefinition | null>
  >;
}): ColumnDef<TaskWithEvents>[] {
  const { accessToken } = useUser();
  const project_id = navigationStateStore((state) => state.project_id);

  const { data: selectedProject }: { data: Project } = useSWR(
    project_id ? [`/api/projects/${project_id}`, accessToken] : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "GET"),
    {
      keepPreviousData: true,
    },
  );

  const events = selectedProject?.settings?.events || {};
  const eventArray = Object.entries(events);

  const { data: uniqueEvents } = useSWR(
    project_id
      ? [`/api/projects/${project_id}/unique-events`, accessToken]
      : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "GET"),
    {
      keepPreviousData: true,
    },
  );

  const columns: ColumnDef<TaskWithEvents>[] = [
    // id
    // {
    //   header: ({ column }) => {
    //     return <></>;
    //   },
    //   accessorKey: "id",
    //   cell: ({ row }) => {
    //     return <></>;
    //   },
    //   enableHiding: true,
    // },
    // Date
    {
      header: ({ column }) => {
        return (
          <div className="flex flex-row items-center space-x-2 justify-between">
            Date
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {
                // Show the sorting icon based on the current sorting state
                column.getIsSorted() === "desc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )
              }
            </Button>
          </div>
        );
      },
      accessorKey: "created_at",
      cell: ({ row }) => (
        <div>
          {formatUnixTimestampToLiteralDatetime(
            Number(row.original.created_at),
          )}
        </div>
      ),
    },
    // Input
    {
      header: "User message",
      accessorKey: "input",
      cell: (row) => {
        const input = row.getValue() as string; // asserting the type as string
        return (
          <Popover>
            <PopoverTrigger
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation();
              }}
              className="text-left"
            >
              {input
                ? input.length > 80
                  ? input.substring(0, 80) + "..."
                  : input
                : "-"}
            </PopoverTrigger>
            <PopoverContent className="text-sm overflow-y-auto max-h-[20rem]">
              {input}
            </PopoverContent>
          </Popover>
        );
      },
      minSize: 100,
    },
    {
      header: "System response",
      accessorKey: "output",
      cell: (row) => {
        const output = row.getValue() as string; // asserting the type as string
        return (
          <Popover>
            <PopoverTrigger
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation();
              }}
              className="text-left"
            >
              {output
                ? output.length > 80
                  ? output.substring(0, 80) + "..."
                  : output
                : "-"}
            </PopoverTrigger>
            <PopoverContent className="text-sm overflow-y-auto max-h-[20rem]">
              {output}
            </PopoverContent>
          </Popover>
        );
      },
      minSize: 100,
    },
    // Language
    {
      header: () => {
        return (
          <div className="flex items-center">
            <Sparkles className="h-4 w-4 mr-1 text-green-500" />
            Language
          </div>
        );
      },
      accessorKey: "language",
      cell: (row) => (
        <HoverCard openDelay={80} closeDelay={30}>
          <HoverCardTrigger>
            <Badge variant={"secondary"}>{row.getValue() as string}</Badge>
          </HoverCardTrigger>
          <HoverCardContent side="top" className="text-sm text-center">
            {getLanguageLabel(row.getValue() as string)}
          </HoverCardContent>
        </HoverCard>
      ),
      maxSize: 10,
    },
    // Human evaluation
    {
      header: "Human evaluation",
      accessorKey: "human_eval",
      cell: (row) => {
        const human_eval = row.getValue() as string; // asserting the type as string
        return (
          <>
            {human_eval && human_eval == "success" && (
              <ThumbsUp className="h-6 w-6 text-green-500" />
            )}{" "}
            {human_eval && human_eval == "failure" && (
              <ThumbsDown className="h-6 w-6 text-red-500 ml-8" />
            )}{" "}
            {!human_eval && (
              <div className="flex space-x-2">
                <ThumbsUp
                  className="h-6 w-6 text-green-500 cursor-pointer hover:fill-green-500"
                  onClick={(mouseEvent) => {
                    mouseEvent.stopPropagation();
                    flagTask({
                      task_id: row.row.original.id,
                      flag: "success",
                      accessToken: accessToken,
                      project_id: project_id,
                      mutateTasks: mutateTasks,
                    });
                  }}
                />
                <ThumbsDown
                  className="h-6 w-6 text-red-500 cursor-pointer hover:fill-red-500"
                  onClick={(mouseEvent) => {
                    mouseEvent.stopPropagation();
                    flagTask({
                      task_id: row.row.original.id,
                      flag: "failure",
                      accessToken: accessToken,
                      project_id: project_id,
                      mutateTasks: mutateTasks,
                    });
                  }}
                />
              </div>
            )}
            <></>
          </>
        );
      },
    },
    // Flag
    {
      header: () => {
        return (
          <div className="flex items-center space-x-2 justify-between">
            <div className="flex items-center">
              <Sparkles className="h-4 mr-1 text-green-500" />
              Automatic eval
            </div>
            <EvalSettings />
          </div>
        );
      },
      accessorKey: "flag",
      cell: (row) => (
        <DropdownMenu>
          <HoverCard openDelay={0} closeDelay={0}>
            <DropdownMenuTrigger>
              <HoverCardTrigger asChild>
                <div className="flex flex-row items-center">
                  <Badge
                    variant={
                      (row.getValue() as string) === "success"
                        ? "secondary"
                        : (row.getValue() as string) === "failure"
                          ? "destructive"
                          : "secondary"
                    }
                    className="hover:border-green-500"
                  >
                    {row.getValue() as string}
                    {row.getValue() === null && <div className="h-3 w-6"></div>}
                  </Badge>
                  {row.row.original.notes && (
                    <PenSquare className="h-4 w-4 ml-1" />
                  )}
                </div>
              </HoverCardTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={(mouseEvent) => {
                  // This is used to avoid clicking on the row as well
                  mouseEvent.stopPropagation();
                  // Flag the task as success
                  flagTask({
                    task_id: row.row.original.id,
                    flag: "success",
                    accessToken: accessToken,
                    project_id: project_id,
                    mutateTasks: mutateTasks,
                  });
                }}
              >
                {(row.getValue() as string) === "success" && (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Success
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(mouseEvent) => {
                  // This is used to avoid clicking on the row as well
                  mouseEvent.stopPropagation();
                  // Flag the task as failure
                  flagTask({
                    task_id: row.row.original.id,
                    flag: "failure",
                    accessToken: accessToken,
                    project_id: project_id,
                    mutateTasks: mutateTasks,
                  });
                }}
              >
                {(row.getValue() as string) === "failure" && (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Failure
              </DropdownMenuItem>
            </DropdownMenuContent>
            <HoverCardContent align="start">
              <div className="flex flex-col space-y-1">
                {!row.row.original.last_eval && <span>No eval</span>}
                {row.row.original.last_eval && (
                  <div>
                    <span className="font-bold">Last eval source: </span>
                    <span>{row.row.original.last_eval?.source}</span>
                  </div>
                )}
                {row.row.original.notes && (
                  <div>
                    <span className="font-bold">Notes: </span>
                    <span>{row.row.original.notes}</span>
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </DropdownMenu>
      ),
    },
    // Events
    {
      header: () => {
        return (
          <div className="flex items-center space-x-2 justify-between">
            <div className="flex flex-row items-center space-x-1">
              <Sparkles className="h-4 w-4 text-green-500" />
              <div>Events</div>
            </div>
            <RunEventsSettings
              eventArray={eventArray}
              setSheetOpen={setSheetOpen}
              setSheetToOpen={setSheetToOpen}
              setEventDefinition={setEventDefinition}
            />
          </div>
        );
      },
      accessorKey: "events",
      cell: (row) => (
        <div className="group flex items-center justify-between">
          <div className="flex flex-wrap items-center justify-center">
            {(row.getValue() as Event[]).map((event: Event) => {
              return (
                <InteractiveEventBadgeForTasks
                  key={`${event.event_name}_task_${row.row.original.id}`}
                  event={event}
                  task={row.row.original as TaskWithEvents}
                  setTask={(task: TaskWithEvents) => {
                    // Use mutateTasks
                    mutateTasks((data: any) => {
                      data.tasks = data.tasks.map(
                        (exisingTask: TaskWithEvents) => {
                          if (exisingTask.id === task.id) {
                            return task;
                          }
                          return exisingTask;
                        },
                      );
                      return data;
                    });
                  }}
                />
              );
            })}
            <AddEventDropdownForTasks
              key={`add_event_task_${row.row.original.id}`}
              task={row.row.original as TaskWithEvents}
              setTask={(task: TaskWithEvents) => {
                mutateTasks((data: any) => {
                  data.tasks = data.tasks.map((exisingTask: TaskWithEvents) => {
                    if (exisingTask.id === task.id) {
                      return task;
                    }
                    return exisingTask;
                  });
                  return data;
                });
              }}
              setSheetOpen={setSheetOpen}
              setSheetToOpen={setSheetToOpen}
            />
          </div>
        </div>
      ),
    },

    // Sentiment Analysis
    {
      header: () => {
        return (
          <div className="flex justify-between items-center space-x-2">
            <div className="flex flex-row items-center">
              <Sparkles className="h-4 w-4 mr-1 text-green-500" />
              Sentiment
            </div>
            <SentimentSettings />
          </div>
        );
      },
      accessorKey: "sentiment.label",
      cell: (row) => {
        const sentiment_label = row.getValue() as string;
        return (
          <div>
            <HoverCard openDelay={80} closeDelay={30}>
              <HoverCardTrigger>
                <Badge
                  className={
                    sentiment_label == "positive"
                      ? "border-green-500"
                      : sentiment_label == "negative"
                        ? "border-red-500"
                        : ""
                  }
                  variant={"secondary"}
                >
                  {sentiment_label}
                </Badge>
              </HoverCardTrigger>
              <HoverCardContent side="top" className="text-sm text-left w-50">
                <h2 className="font-bold">Sentiment label</h2>
                <p>Automatic sentiment analysis of the user message</p>
              </HoverCardContent>
            </HoverCard>
          </div>
        );
      },
      maxSize: 10,
    },

    {
      header: "",
      accessorKey: "view",
      cell: ({ row }) => {
        const task = row.original;
        // Match the task object with this key
        // Handle undefined edge case
        if (!task) return <></>;
        return (
          <Link href={`/org/transcripts/tasks/${encodeURIComponent(task.id)}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight />
            </Button>
          </Link>
        );
      },
      size: 10,
      minSize: 10,
      maxSize: 10,
    },
  ];
  return columns;
}

import { useGetMyTasks, getGetMyTasksQueryKey, useUpdateTask } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Calendar as CalendarIcon, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("due_asc");
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();

  const { data: tasks, isLoading } = useGetMyTasks({
    query: { queryKey: getGetMyTasksQueryKey() }
  });

  const handleToggleStatus = (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    updateTask.mutate({ id: taskId, data: { status: newStatus as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  const filteredTasks = tasks?.filter(t => statusFilter === "all" ? true : t.status === statusFilter) || [];
  
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortOrder === "due_asc") {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (sortOrder === "priority") {
      const pMap: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return pMap[a.priority] - pMap[b.priority];
    }
    return 0;
  });

  const priorityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Tasks</h1>
          <p className="text-muted-foreground mt-1">Tasks assigned to you across all projects.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_asc">Due Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {sortedTasks.map(task => (
          <Card key={task.id} className={`transition-all hover:shadow-md border-border ${task.status === 'done' ? 'opacity-60 bg-muted/30' : 'bg-card'}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <button 
                onClick={() => handleToggleStatus(task.id, task.status)}
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              >
                {task.status === 'done' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <Circle className="h-6 w-6" />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <Link href={`/projects/${task.projectId}`} className="group block">
                  <p className={`font-medium truncate group-hover:text-primary transition-colors ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="truncate max-w-[150px]">{task.project?.name}</span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
              
              <div className="flex-shrink-0 flex items-center gap-2">
                <Badge variant="outline" className={`${priorityColors[task.priority]} capitalize border-transparent text-[10px]`}>
                  {task.priority}
                </Badge>
                <Badge variant="outline" className="capitalize hidden sm:inline-flex">
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {sortedTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-card/50">
            <CheckSquare className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No tasks found</h3>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' ? "Try changing your filters to see more tasks." : "You're all caught up!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
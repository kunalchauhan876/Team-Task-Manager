import { useGetDashboardStats, getGetDashboardStatsQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey, useGetMyTasks, getGetMyTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, CheckSquare, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });
  
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });

  const { data: tasks, isLoading: tasksLoading } = useGetMyTasks({
    query: { queryKey: getGetMyTasksQueryKey() }
  });

  if (statsLoading || activityLoading || tasksLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const statusColors: Record<string, string> = {
    todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening across your projects.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalProjects || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-muted-foreground shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalTasks || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.completedTasks || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.overdueTasks || 0}</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex justify-between items-center">
                My Tasks
                <Link href="/tasks" className="text-sm text-primary hover:underline font-normal">View all</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="space-y-3">
                  {tasks?.slice(0, 5).map(task => (
                    <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                      <div className="p-3 border rounded-lg hover:border-primary hover:shadow-sm transition-all bg-card flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{task.project?.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge variant="outline" className={statusColors[task.status] || ""}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(task.dueDate), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(!tasks || tasks.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                      No tasks assigned to you yet.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-md">Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.tasksByStatus?.map(status => (
                    <div key={status.status} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{status.status.replace('_', ' ')}</span>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{status.count}</span>
                    </div>
                  ))}
                  {(!stats?.tasksByStatus || stats.tasksByStatus.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm">No data</div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-md">Tasks by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.tasksByPriority?.map(priority => (
                    <div key={priority.priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${priorityColors[priority.priority]?.split(' ')[0] || 'bg-gray-400'}`}></div>
                        <span className="text-sm font-medium capitalize">{priority.priority}</span>
                      </div>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{priority.count}</span>
                    </div>
                  ))}
                  {(!stats?.tasksByPriority || stats.tasksByPriority.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm">No data</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-sm flex flex-col h-[400px] lg:h-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full px-6 pb-6">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {activity?.map((item, index) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <div className="w-2 h-2 rounded-full bg-background"></div>
                    </div>
                    
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border bg-card shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary">{item.userName}</span>
                        <time className="text-[10px] text-muted-foreground font-mono">{formatDistanceToNow(new Date(item.createdAt))} ago</time>
                      </div>
                      <div className="text-sm text-foreground mb-1">{item.description}</div>
                      <Link href={`/projects/${item.projectId}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        in {item.projectName}
                      </Link>
                    </div>
                  </div>
                ))}
                {(!activity || activity.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg bg-card/50 relative z-20">
                    No recent activity to show.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
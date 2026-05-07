import { useState } from "react";
import { 
  useGetProject, getGetProjectQueryKey, 
  useListProjectTasks, getListProjectTasksQueryKey, 
  useUpdateTask, useCreateTask, useDeleteTask, 
  useListProjectMembers, getListProjectMembersQueryKey,
  useAddProjectMember, useUpdateProjectMember, useRemoveProjectMember,
  useUpdateProject, useDeleteProject,
  Task, CreateTaskBodyStatus, CreateTaskBodyPriority 
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Calendar, ArrowLeft, Settings as SettingsIcon, Users, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TASK_STATUSES = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: tasks, isLoading: tasksLoading } = useListProjectTasks(projectId, {}, {
    query: { enabled: !!projectId, queryKey: getListProjectTasksQueryKey(projectId) }
  });

  const { data: members } = useListProjectMembers(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectMembersQueryKey(projectId) }
  });

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const addMember = useAddProjectMember();
  const updateMember = useUpdateProjectMember();
  const removeMember = useRemoveProjectMember();

  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Settings Dialog
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectStatus, setProjectStatus] = useState<string>("active");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

  const openSettings = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDesc(project.description || "");
      setProjectStatus(project.status);
      setIsSettingsOpen(true);
    }
  };

  const handleUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject.mutate({
      id: projectId,
      data: { name: projectName, description: projectDesc, status: projectStatus as any }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Project updated" });
      }
    });
  };

  const handleDeleteProject = () => {
    if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
      deleteProject.mutate({ id: projectId }, {
        onSuccess: () => {
          toast({ title: "Project deleted" });
          setLocation("/projects");
        }
      });
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail) return;
    addMember.mutate({
      id: projectId,
      data: { email: memberEmail, role: memberRole }
    }, {
      onSuccess: () => {
        setMemberEmail("");
        queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
        toast({ title: "Member added" });
      },
      onError: () => {
        toast({ title: "Failed to add member", description: "Check if the email is correct and the user exists.", variant: "destructive" });
      }
    });
  };

  const handleRemoveMember = (memberId: number) => {
    if (confirm("Remove this member from the project?")) {
      removeMember.mutate({ id: projectId, memberId: memberId as any }, { // API type might expect memberId in path, check API spec. Assuming path uses userId or memberId
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
          toast({ title: "Member removed" });
        }
      });
    }
  };

  const handleRoleChange = (memberId: number, newRole: "admin" | "member") => {
    updateMember.mutate({
      id: projectId,
      memberId: memberId as any, // assuming it's part of params, check API client implementation
      data: { role: newRole }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
        toast({ title: "Role updated" });
      }
    });
  };
  
  // Form State
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<CreateTaskBodyStatus>("todo");
  const [taskPriority, setTaskPriority] = useState<CreateTaskBodyPriority>("medium");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("none");

  const openNewTask = (status: CreateTaskBodyStatus = "todo") => {
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskStatus(status);
    setTaskPriority("medium");
    setTaskAssigneeId("none");
    setIsTaskOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskStatus(task.status as CreateTaskBodyStatus);
    setTaskPriority(task.priority as CreateTaskBodyPriority);
    setTaskAssigneeId(task.assigneeId ? String(task.assigneeId) : "none");
    setIsTaskOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const data = {
      title: taskTitle,
      description: taskDescription,
      status: taskStatus,
      priority: taskPriority,
      assigneeId: taskAssigneeId === "none" ? null : Number(taskAssigneeId)
    };

    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, data }, {
        onSuccess: () => {
          setIsTaskOpen(false);
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: "Task updated" });
        }
      });
    } else {
      createTask.mutate({ id: projectId, data }, {
        onSuccess: () => {
          setIsTaskOpen(false);
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: "Task created" });
        }
      });
    }
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTask.mutate({ id: taskId, data: { status: newStatus as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id: taskId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: "Task deleted" });
        }
      });
    }
  };

  const priorityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  if (projectLoading || tasksLoading) {
    return <div className="p-8"><Skeleton className="h-10 w-64 mb-8" /><div className="flex gap-6"><Skeleton className="h-96 w-1/4" /><Skeleton className="h-96 w-1/4" /><Skeleton className="h-96 w-1/4" /><Skeleton className="h-96 w-1/4" /></div></div>;
  }

  if (!project) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex-none p-6 border-b border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Badge variant="outline" className="capitalize">{project.status}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 mr-2" title={`${members?.length || 0} members`}>
            {members?.slice(0, 3).map(m => (
              <div key={m.id} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-xs font-medium text-primary">
                {m.user.name.charAt(0)}
              </div>
            ))}
            {members && members.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs text-muted-foreground">
                +{members.length - 3}
              </div>
            )}
          </div>
          <Button onClick={() => openNewTask()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
          {project.myRole === 'admin' && (
            <Button variant="outline" size="icon" onClick={openSettings}>
              <SettingsIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-background/50">
        <div className="flex gap-6 h-full items-start min-w-max">
          {TASK_STATUSES.map(status => {
            const columnTasks = tasks?.filter(t => t.status === status.id) || [];
            
            return (
              <div key={status.id} className="w-[320px] flex flex-col h-full max-h-full">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {status.label}
                    <span className="bg-muted text-muted-foreground text-xs py-0.5 px-2 rounded-full font-mono">
                      {columnTasks.length}
                    </span>
                  </h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNewTask(status.id as CreateTaskBodyStatus)}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pb-6 pr-1">
                  {columnTasks.map(task => (
                    <Card key={task.id} className="hover:border-primary/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-border">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] uppercase font-bold border-transparent ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditTask(task)}>Edit Task</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move to</div>
                              {TASK_STATUSES.filter(s => s.id !== task.status).map(s => (
                                <DropdownMenuItem key={s.id} onClick={() => handleStatusChange(task.id, s.id)}>
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                              {(project.myRole === 'admin' || task.createdById === project.ownerId) && ( // Using ownerId as fallback if createdBy doesn't match
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                    Delete Task
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <p className="font-medium text-sm mb-2 leading-snug">{task.title}</p>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center text-xs text-muted-foreground">
                            {task.dueDate && (
                              <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(task.dueDate), "MMM d")}</span>
                              </div>
                            )}
                          </div>
                          {task.assigneeId && (
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-background shadow-sm" title="Assigned">
                              {members?.find(m => m.userId === task.assigneeId)?.user.name.charAt(0) || "?"}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="h-24 rounded-lg border-2 border-dashed border-border/50 bg-card/30 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">Drop tasks here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Dialog */}
      <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTask} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title..." required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Add details..." rows={3} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={taskStatus} onValueChange={(v: any) => setTaskStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members?.map(m => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsTaskOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending || !taskTitle.trim()}>
                {createTask.isPending || updateTask.isPending ? "Saving..." : "Save Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog (Admin Only) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle>Project Settings</DialogTitle>
            </DialogHeader>
          </div>
          
          <Tabs defaultValue="general" className="w-full">
            <div className="px-6 border-b border-border mt-4">
              <TabsList className="bg-transparent h-auto p-0 mb-[-1px]">
                <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">General</TabsTrigger>
                <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Members</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <TabsContent value="general" className="m-0 space-y-6">
                <form id="project-form" onSubmit={handleUpdateProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input id="projectName" value={projectName} onChange={e => setProjectName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectDesc">Description</Label>
                    <Textarea id="projectDesc" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={projectStatus} onValueChange={setProjectStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={updateProject.isPending}>Save Changes</Button>
                  </div>
                </form>
                
                <div className="border-t border-border pt-6 mt-6">
                  <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
                  <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Delete this project</p>
                      <p className="text-xs text-muted-foreground mt-1">Once deleted, it will be gone forever.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleDeleteProject} disabled={deleteProject.isPending}>
                      Delete Project
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="members" className="m-0 space-y-6">
                <form onSubmit={handleAddMember} className="flex gap-2 items-end border-b border-border pb-6">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="email">Invite Member</Label>
                    <Input id="email" type="email" placeholder="email@example.com" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2 w-[120px]">
                    <Label>Role</Label>
                    <Select value={memberRole} onValueChange={(v: any) => setMemberRole(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={addMember.isPending}>Invite</Button>
                </form>
                
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Project Members ({members?.length || 0})</h4>
                  <div className="space-y-3">
                    {members?.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-card">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.user.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{member.user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{member.user.name}</p>
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={member.role} 
                            onValueChange={(v: any) => handleRoleChange(member.id, v)}
                            disabled={updateMember.isPending || member.userId === project.ownerId}
                          >
                            <SelectTrigger className="h-8 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member" className="text-xs">Member</SelectItem>
                              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removeMember.isPending || member.userId === project.ownerId}
                            title={member.userId === project.ownerId ? "Cannot remove owner" : "Remove member"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
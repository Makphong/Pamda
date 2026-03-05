import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Settings, 
  Layers, 
  LayoutGrid, 
  X, 
  Trash2, 
  Edit2, 
  Clock, 
  AlignLeft, 
  CalendarDays,
  Check,
  ArrowLeft,
  FolderTree,
  CheckSquare,
  Copy,
  Paperclip,
  CheckCircle,
  FileText,
  BarChart2,
  Users,
  MessageSquare,
  Lock,
  Search,
  Filter,
  Link as LinkIcon,
  Target,
  Activity,
  ChevronDown,
  MoreHorizontal,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Flag
} from 'lucide-react';

// --- Constants & Helpers ---
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const DAYS_OF_WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const PROJECT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-800', lightBg: 'bg-blue-100', border: 'border-blue-200' },
  { bg: 'bg-red-500', text: 'text-red-800', lightBg: 'bg-red-100', border: 'border-red-200' },
  { bg: 'bg-green-500', text: 'text-green-800', lightBg: 'bg-green-100', border: 'border-green-200' },
  { bg: 'bg-purple-500', text: 'text-purple-800', lightBg: 'bg-purple-100', border: 'border-purple-200' },
  { bg: 'bg-orange-500', text: 'text-orange-800', lightBg: 'bg-orange-100', border: 'border-orange-200' },
  { bg: 'bg-pink-500', text: 'text-pink-800', lightBg: 'bg-pink-100', border: 'border-pink-200' },
  { bg: 'bg-teal-500', text: 'text-teal-800', lightBg: 'bg-teal-100', border: 'border-teal-200' },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Main Application Component ---
export default function App() {
  // --- State ---
  const [projects, setProjects] = useState([
    { 
      id: 'p1', name: 'Project Alpha', colorIndex: 0, isVisible: true, 
      status: 'on_track', 
      vision: 'มุ่งมั่นที่จะเป็นผู้นำในการพัฒนานวัตกรรมที่ตอบโจทย์ความต้องการของผู้ใช้งานระดับโลก',
      mission: '1. พัฒนาผลิตภัณฑ์ที่มีคุณภาพสูง\n2. ส่งเสริมการเรียนรู้และพัฒนาศักยภาพของทีมงานอย่างต่อเนื่อง',
      description: 'โปรเจกต์ Project Alpha มีจุดประสงค์เพื่อจัดการและติดตามความคืบหน้าของงานทั้งหมดที่เกี่ยวข้องกับเป้าหมายหลัก\n\n- เพิ่มยอด Engagement 20% ภายในไตรมาสนี้\n- พัฒนาและอัปเดตระบบให้รองรับผู้ใช้งานมากขึ้น\n- ลดข้อผิดพลาด (Bugs) ในระบบหลักลง 50%', 
      milestones: [
        { id: 'm1', name: 'วางแผนและกำหนดขอบเขต (Project Kickoff)', date: '2026-03-15', status: 'completed' },
        { id: 'm2', name: 'ส่งมอบผลงานเฟสที่ 1 (Phase 1 Delivery)', date: '2026-04-30', status: 'pending' },
        { id: 'm3', name: 'ทดสอบระบบและแก้ไข (UAT)', date: '2026-05-15', status: 'pending' }
      ] 
    },
    { id: 'p2', name: 'Marketing Q1', colorIndex: 1, isVisible: true, status: 'on_track', vision: '', mission: '', description: '', milestones: [] },
    { id: 'p3', name: 'Website Revamp', colorIndex: 2, isVisible: true, status: 'at_risk', vision: '', mission: '', description: '', milestones: [] },
    { id: 'p4', name: 'Team Outing', colorIndex: 3, isVisible: true, status: 'on_track', vision: '', mission: '', description: '', milestones: [] },
    { id: 'p5', name: 'Backlog', colorIndex: 4, isVisible: false, status: 'off_track', vision: '', mission: '', description: '', milestones: [] },
  ]);

  const [events, setEvents] = useState([
    {
      id: 'e1', projectId: 'p1', title: 'Kickoff Meeting',
      startDate: '2026-03-05', endDate: '2026-03-05',
      startTime: '10:00', endTime: '12:00', description: 'เริ่มโปรเจกต์ใหม่',
      status: 'Done', department: 'Management', assigneeId: 'u1'
    },
    {
      id: 'e2', projectId: 'p2', title: 'Ad Campaign',
      startDate: '2026-03-10', endDate: '2026-03-15',
      startTime: '09:00', endTime: '18:00', description: 'ยิงแอด Facebook',
      status: 'In Progress', department: 'Marketing', assigneeId: 'u2'
    },
    {
      id: 'e3', projectId: 'p1', title: 'Design System Update',
      startDate: '2026-03-12', endDate: '2026-03-18',
      startTime: '13:00', endTime: '17:00', description: 'อัปเดต UI Components',
      status: 'To Do', department: 'Design', assigneeId: 'u2'
    },
    {
      id: 'e4', projectId: 'p1', title: 'API Integration',
      startDate: '2026-03-20', endDate: '2026-03-25',
      startTime: '09:00', endTime: '18:00', description: 'เชื่อมต่อ Backend',
      status: 'Review', department: 'Development', assigneeId: 'u3'
    }
  ]);

  const [isMergeView, setIsMergeView] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Project Dashboard Navigation
  const [activeDashboardProjectId, setActiveDashboardProjectId] = useState(null);

  // Data for Event Modal
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState(null);
  const [preSelectedProjectId, setPreSelectedProjectId] = useState(null);

  // --- New Settings State ---
  const [displayRange, setDisplayRange] = useState(() => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endObj = new Date(now.getFullYear(), now.getMonth() + 11, 1);
    const end = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}`;
    return { start, end };
  });
  const [hidePastWeeks, setHidePastWeeks] = useState(true);

  // Current week calculation
  const currentWeekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, []);

  // Generate months for the scrollable view
  const monthsToRender = useMemo(() => {
    if (!displayRange.start || !displayRange.end) return [];
    const [startYear, startMonth] = displayRange.start.split('-').map(Number);
    const [endYear, endMonth] = displayRange.end.split('-').map(Number);
    
    const months = [];
    let y = startYear;
    let m = startMonth - 1; 

    while (y < endYear || (y === endYear && m <= endMonth - 1)) {
      const lastDayOfMonth = new Date(y, m + 1, 0);
      const isCompletelyPast = hidePastWeeks && lastDayOfMonth < currentWeekStart;
      
      if (!isCompletelyPast) {
        months.push({ year: y, month: m });
      }

      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (months.length > 60) break; // Limit to 5 years max to prevent infinite loops
    }
    return months;
  }, [displayRange, hidePastWeeks, currentWeekStart]);

  // Derived state
  const visibleProjects = projects.filter(p => p.isVisible);

  // --- Handlers ---
  const handleDayClick = (dateStr, projectId) => {
    setEditingEvent(null);
    setSelectedDateForNewEvent(dateStr);
    setPreSelectedProjectId(projectId || (visibleProjects.length > 0 ? visibleProjects[0].id : ''));
    setShowEventModal(true);
  };

  const handleNewEventClick = () => {
    setEditingEvent(null);
    // ตั้งค่าเริ่มต้นเป็นวันที่ปัจจุบัน
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setSelectedDateForNewEvent(todayStr);
    setPreSelectedProjectId(visibleProjects.length > 0 ? visibleProjects[0].id : (projects.length > 0 ? projects[0].id : ''));
    setShowEventModal(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation(); // Prevent triggering day click
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const saveEvent = (eventData) => {
    if (editingEvent) {
      setEvents(events.map(ev => ev.id === editingEvent.id ? { ...ev, ...eventData } : ev));
    } else {
      setEvents([...events, { 
        ...eventData, 
        id: generateId(),
        status: 'To Do',
        department: 'Unassigned',
        assigneeId: 'u' + (Math.floor(Math.random() * 5) + 1) // สุ่ม Assign คนรับผิดชอบ (Mock)
      }]);
    }
    setShowEventModal(false);
  };

  const updateEvent = (eventId, updates) => {
    setEvents(events.map(ev => ev.id === eventId ? { ...ev, ...updates } : ev));
  };

  const deleteEvent = (eventId) => {
    setEvents(events.filter(ev => ev.id !== eventId));
    setShowEventModal(false);
  };

  const toggleProjectVisibility = (projectId) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        // Prevent enabling if already 4 visible
        if (!p.isVisible && visibleProjects.length >= 4) {
          alert("คุณสามารถแสดงได้สูงสุดเพียง 4 โปรเจกต์ในหน้าจอหลัก");
          return p;
        }
        return { ...p, isVisible: !p.isVisible };
      }
      return p;
    }));
  };

  const saveProject = (projectData) => {
    if (projectData.id) {
      setProjects(projects.map(p => p.id === projectData.id ? { ...p, ...projectData } : p));
    } else {
      const newProject = { 
        ...projectData, 
        id: generateId(), 
        isVisible: visibleProjects.length < 4,
        status: 'on_track',
        description: '',
        milestones: []
      };
      setProjects([...projects, newProject]);
    }
  };

  const updateProjectDetails = (projectId, updates) => {
    setProjects(projects.map(p => p.id === projectId ? { ...p, ...updates } : p));
  };

  const deleteProject = (projectId) => {
    setProjects(projects.filter(p => p.id !== projectId));
    setEvents(events.filter(ev => ev.projectId !== projectId)); // Cascade delete
    if (activeDashboardProjectId === projectId) setActiveDashboardProjectId(null);
  };

  // --- Render App View vs Project Dashboard View ---
  if (activeDashboardProjectId) {
    const activeProject = projects.find(p => p.id === activeDashboardProjectId);
    if (activeProject) {
      return (
        <ProjectDashboard 
          project={activeProject} 
          events={events.filter(e => e.projectId === activeProject.id)}
          onBack={() => setActiveDashboardProjectId(null)} 
          onUpdateEvent={updateEvent}
          onSaveTask={(taskData) => {
            if (taskData.id) {
              updateEvent(taskData.id, taskData);
            } else {
              setEvents([...events, { ...taskData, id: generateId(), projectId: activeProject.id }]);
            }
          }}
          onDeleteTask={deleteEvent}
          onUpdateProject={updateProjectDetails}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-sm md:text-base">
      
      {/* --- Top Navigation Bar --- */}
      <header className="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800 hidden md:block">Multi-Project Calendar</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg border">
            <button
              onClick={() => setIsMergeView(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${!isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Split View</span>
            </button>
            <button
              onClick={() => setIsMergeView(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${isMergeView ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Merge View</span>
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-2"></div>

          {/* Add Event Button */}
          <button
            onClick={handleNewEventClick}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">เพิ่ม Event</span>
          </button>

          {/* Project Management Button */}
          <button
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>จัดการ Project</span>
          </button>
        </div>
      </header>

      {/* --- Main Calendar Board --- */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        {visibleProjects.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col text-gray-400 gap-4">
            <LayoutGrid className="w-16 h-16 opacity-50" />
            <p className="text-lg">กรุณาเลือกหรือเพิ่มโปรเจกต์จากเมนู "จัดการ Project"</p>
          </div>
        ) : (
          <div className="min-w-[800px]"> {/* Ensure it doesn't squish too much on small screens */}
            
            {/* Sticky Project Headers (Only in Split View) */}
            {!isMergeView && (
              <div className="sticky top-0 z-10 flex bg-white shadow-sm border-b">
                {visibleProjects.map((project) => (
                  <div 
                    key={project.id} 
                    onClick={() => setActiveDashboardProjectId(project.id)}
                    className="flex-1 text-center py-3 border-r last:border-r-0 relative overflow-hidden cursor-pointer hover:bg-blue-50 transition-colors group flex flex-col items-center justify-center h-16"
                  >
                    <div className={`absolute top-0 left-0 w-full h-1 ${PROJECT_COLORS[project.colorIndex].bg}`}></div>
                    <span className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors text-base">{project.name}</span>
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1">
                      คลิกเพื่อเปิดหน้าบริหารจัดการ
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Merge View Sticky Header */}
            {isMergeView && (
              <div className="sticky top-0 z-10 bg-white shadow-sm border-b py-3 text-center h-16 flex items-center justify-center">
                <span className="font-bold text-gray-700 text-lg">รวมทุก Project ({visibleProjects.length})</span>
              </div>
            )}

            {/* Months List (Continuous Scroll) */}
            {monthsToRender.length === 0 ? (
              <div className="flex justify-center items-center h-48 text-gray-500">
                ไม่มีสัปดาห์ที่จะแสดงผลในช่วงเวลาที่เลือก
              </div>
            ) : (
              <div className="flex flex-col">
                {monthsToRender.map(({ month, year }, idx) => (
                  <div key={`${year}-${month}`} className="border-b-4 border-gray-200">
                    {/* Month Title */}
                    <div className="bg-gray-100 py-2 px-4 sticky top-16 z-0 shadow-sm border-b border-gray-200">
                      <h2 className="text-lg font-bold text-gray-800">
                        {THAI_MONTHS[month]} {year}
                      </h2>
                    </div>

                    <div className="flex">
                      {isMergeView ? (
                        // Merge View: 1 Full Width Calendar
                        <div className="flex-1 bg-white p-2">
                          <MonthGrid 
                            year={year} 
                            month={month} 
                            projects={visibleProjects} 
                            events={events}
                            onDayClick={(dateStr) => handleDayClick(dateStr, null)}
                            onEventClick={handleEventClick}
                            hidePastWeeks={hidePastWeeks}
                            currentWeekStart={currentWeekStart}
                          />
                        </div>
                      ) : (
                        // Split View: 4 Calendars Side-by-Side
                        visibleProjects.map((project) => (
                          <div key={project.id} className="flex-1 border-r last:border-r-0 border-gray-200 bg-white p-2">
                            <MonthGrid 
                              year={year} 
                              month={month} 
                              projects={[project]} 
                              events={events.filter(e => e.projectId === project.id)}
                              onDayClick={(dateStr) => handleDayClick(dateStr, project.id)}
                              onEventClick={handleEventClick}
                              hidePastWeeks={hidePastWeeks}
                              currentWeekStart={currentWeekStart}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      {showProjectModal && (
        <ProjectManagerModal 
          projects={projects}
          onClose={() => setShowProjectModal(false)}
          onToggleVisibility={toggleProjectVisibility}
          onSaveProject={saveProject}
          onDeleteProject={deleteProject}
          displayRange={displayRange}
          setDisplayRange={setDisplayRange}
          hidePastWeeks={hidePastWeeks}
          setHidePastWeeks={setHidePastWeeks}
        />
      )}

      {showEventModal && (
        <EventModal
          event={editingEvent}
          projects={projects} // Show all available projects in dropdown
          defaultDate={selectedDateForNewEvent}
          defaultProjectId={preSelectedProjectId}
          onClose={() => setShowEventModal(false)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}

    </div>
  );
}


// ==========================================
// Sub-Components
// ==========================================

// --- Editable Section Component (Vision & Mission) ---
const EditableSection = ({ title, icon: Icon, value, placeholder, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-500" />
          {title}
        </h3>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea 
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">ยกเลิก</button>
            <button 
              onClick={handleSave} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> บันทึก
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none whitespace-pre-wrap">
          {value ? (
            <p>{value}</p>
          ) : (
            <p className="text-gray-400 italic">ยังไม่มีข้อมูล คลิกปุ่มแก้ไขเพื่อเพิ่ม...</p>
          )}
        </div>
      )}
    </div>
  );
};

// --- Project Dashboard View (Like Asana) ---
function ProjectDashboard({ project, events, onBack, onUpdateEvent, onSaveTask, onDeleteTask, onUpdateProject }) {
  // เปลี่ยนค่าเริ่มต้นให้เปิดหน้า Project Organization เป็นอันดับแรก
  const [activeTab, setActiveTab] = useState('organization'); 
  const projectColor = PROJECT_COLORS[project.colorIndex] || PROJECT_COLORS[0];

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  // States for Production-ready Project Organization
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState('');
  
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  
  // Local state for Team Notes
  const [noteSection, setNoteSection] = useState('department'); // 'department' | 'member'
  const [activeNoteId, setActiveNoteId] = useState('Management');
  const [notesContent, setNotesContent] = useState({});

  // Local state for Team Management mock data
  const [teamMembers, setTeamMembers] = useState([
    { id: 'u1', name: 'Admin Manager', role: 'Project Owner', initials: 'AM', color: 'bg-blue-600', level: 1 },
    { id: 'u2', name: 'Design Ops', role: 'Approver', initials: 'DO', color: 'bg-purple-500', level: 2 },
    { id: 'u3', name: 'Tech Lead', role: 'Manager', initials: 'TL', color: 'bg-orange-400', level: 2 },
    { id: 'u4', name: 'Frontend Dev', role: 'Contributor', initials: 'FD', color: 'bg-green-500', level: 3 },
    { id: 'u5', name: 'QA Engineer', role: 'Contributor', initials: 'QA', color: 'bg-pink-500', level: 3 },
  ]);
  
  const statusConfig = {
    on_track: { label: 'On Track (ตามแผน)', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
    at_risk: { label: 'At Risk (มีความเสี่ยง)', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
    off_track: { label: 'Off Track (ล่าช้า)', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  };

  const TABS = [
    { id: 'organization', icon: FolderTree, label: 'Project Organization' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Management' },
    { id: 'team', icon: Users, label: 'Team Management' },
    { id: 'notes', icon: FileText, label: 'Team Notes' }
  ];

  const removeMember = (id) => {
    if (window.confirm('ยืนยันการลบสมาชิกคนนี้ออกจากโปรเจกต์?')) {
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    }
  };

  // --- Task Management View Logic ---
  const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
  const DEPARTMENTS = ['Management', 'Marketing', 'Design', 'Development', 'QA', 'Unassigned'];

  const [taskView, setTaskView] = useState('table');
  const [statusFilter, setStatusFilter] = useState([]);
  const [deptFilter, setDeptFilter] = useState([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  
  // Slide-over Pane State
  const [paneTask, setPaneTask] = useState(null);
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  
  const filteredTasks = events.filter(ev => {
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(ev.status || 'To Do');
    const matchDept = deptFilter.length === 0 || deptFilter.includes(ev.department || 'Unassigned');
    return matchStatus && matchDept;
  });

  const handleStatusChange = (eventId, newStatus) => {
    if (onUpdateEvent) {
      onUpdateEvent(eventId, { status: newStatus });
    }
  };

  const getAssignee = (id) => teamMembers.find(m => m.id === id) || { name: 'Unassigned', initials: '?', color: 'bg-gray-400', role: '' };

  const openTaskDetail = (task) => {
    setPaneTask(task);
    setIsPaneOpen(true);
  };

  const openAddTask = () => {
    setPaneTask(null);
    setIsPaneOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans relative">
      {/* Dashboard Header */}
      <header className={`px-6 py-4 flex items-center gap-4 border-b shrink-0 ${projectColor.lightBg}`}>
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-4 h-4 rounded-full ${projectColor.bg}`}></div>
        <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
      </header>

      {/* Dashboard Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-gray-50 border-r flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Management</p>
            <nav className="space-y-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-6xl mx-auto">
            
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
            </div>

            {/* Content Mockups Based on Active Tab */}
            {activeTab === 'organization' && (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Content (Left) */}
                <div className="flex-1 space-y-6">
                  
                  {/* Vision Section */}
                  <EditableSection 
                    title="วิสัยทัศน์ (Vision)" 
                    icon={Target} 
                    value={project.vision} 
                    placeholder="กรอกวิสัยทัศน์ของโครงการที่นี่..."
                    onSave={(newVision) => onUpdateProject(project.id, { vision: newVision })}
                  />

                  {/* Mission Section */}
                  <EditableSection 
                    title="พันธกิจ (Mission)" 
                    icon={Flag} 
                    value={project.mission} 
                    placeholder="กรอกพันธกิจของโครงการที่นี่..."
                    onSave={(newMission) => onUpdateProject(project.id, { mission: newMission })}
                  />

                  {/* Description Section */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <AlignLeft className="w-5 h-5 text-gray-500" />
                        รายละเอียดโปรเจกต์ (Project Description)
                      </h3>
                      {!isEditingDesc && (
                        <button 
                          onClick={() => {
                            setEditDescText(project.description || '');
                            setIsEditingDesc(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {isEditingDesc ? (
                      <div className="flex flex-col gap-3">
                        <textarea 
                          value={editDescText}
                          onChange={e => setEditDescText(e.target.value)}
                          placeholder="เพิ่มรายละเอียดและเป้าหมายของโปรเจกต์ที่นี่..."
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          autoFocus
                        ></textarea>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setIsEditingDesc(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">ยกเลิก</button>
                          <button 
                            onClick={() => {
                              onUpdateProject(project.id, { description: editDescText });
                              setIsEditingDesc(false);
                            }} 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            บันทึก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none whitespace-pre-wrap">
                        {project.description ? (
                          <p>{project.description}</p>
                        ) : (
                          <p className="text-gray-400 italic">ยังไม่มีรายละเอียดโปรเจกต์ คลิกปุ่มแก้ไขเพื่อเพิ่มข้อมูล</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Milestones / Goals Section */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Target className="w-5 h-5 text-gray-500" />
                        เป้าหมายหลัก & จุดวิกฤต (Milestones)
                      </h3>
                      {!isAddingMilestone && (
                        <button 
                          onClick={() => setIsAddingMilestone(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" /> เพิ่มเป้าหมาย
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {(project.milestones || []).map((m, i) => (
                        <div key={m.id || i} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-transparent transition-colors group">
                          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => {
                            const updatedMilestones = (project.milestones || []).map(ms => ms.id === m.id ? { ...ms, status: ms.status === 'completed' ? 'pending' : 'completed' } : ms);
                            onUpdateProject(project.id, { milestones: updatedMilestones });
                          }}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${m.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                              {m.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`font-medium ${m.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-sm ${m.status === 'completed' ? 'text-gray-400' : 'text-blue-600 font-medium'}`}>{m.date}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if(window.confirm('ลบเป้าหมายนี้?')) {
                                  const updatedMilestones = (project.milestones || []).filter(ms => ms.id !== m.id);
                                  onUpdateProject(project.id, { milestones: updatedMilestones });
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {(project.milestones || []).length === 0 && !isAddingMilestone && (
                        <div className="text-center py-6 text-gray-400 text-sm italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          ยังไม่มีเป้าหมายของโปรเจกต์
                        </div>
                      )}

                      {/* Add Milestone Form */}
                      {isAddingMilestone && (
                        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 flex flex-col gap-3 mt-4">
                          <input 
                            type="text" 
                            placeholder="ชื่อเป้าหมาย / Milestone..." 
                            value={newMilestoneName}
                            onChange={e => setNewMilestoneName(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="flex items-center gap-3">
                            <input 
                              type="date" 
                              value={newMilestoneDate}
                              onChange={e => setNewMilestoneDate(e.target.value)}
                              className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                            />
                            <button 
                              onClick={() => {
                                if (!newMilestoneName || !newMilestoneDate) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
                                const updatedMilestones = [...(project.milestones || []), { id: generateId(), name: newMilestoneName, date: newMilestoneDate, status: 'pending' }];
                                onUpdateProject(project.id, { milestones: updatedMilestones });
                                setNewMilestoneName('');
                                setNewMilestoneDate('');
                                setIsAddingMilestone(false);
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              เพิ่ม
                            </button>
                            <button 
                              onClick={() => setIsAddingMilestone(false)}
                              className="text-gray-600 hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Sidebar (Right) */}
                <div className="w-full lg:w-[340px] flex flex-col gap-6 shrink-0">
                  
                  {/* Status Dropdown */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> สถานะโปรเจกต์
                    </h3>
                    <div 
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${statusConfig[project.status || 'on_track'].bg} ${statusConfig[project.status || 'on_track'].text} ${statusConfig[project.status || 'on_track'].border}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${statusConfig[project.status || 'on_track'].dot} shadow-sm`}></div>
                      <span className="font-semibold flex-1">{statusConfig[project.status || 'on_track'].label}</span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </div>
                    
                    {/* Status Dropdown Menu */}
                    {isStatusDropdownOpen && (
                      <div className="absolute top-[85px] left-5 right-5 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <div 
                            key={key}
                            onClick={() => { 
                              onUpdateProject(project.id, { status: key });
                              setIsStatusDropdownOpen(false); 
                            }}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b last:border-0 ${(project.status || 'on_track') === key ? 'bg-gray-50' : ''}`}
                          >
                            <div className={`w-3 h-3 rounded-full ${config.dot}`}></div>
                            <span className={`font-medium ${config.text}`}>{config.label}</span>
                            {(project.status || 'on_track') === key && <Check className="w-4 h-4 ml-auto text-gray-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-3 flex items-center justify-between">
                      <span>คลิกเพื่อเปลี่ยนสถานะ</span>
                    </p>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                
                {/* Controls: Filter & View Toggle */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="relative">
                    <button 
                      onClick={() => setShowFilterPopup(!showFilterPopup)}
                      className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors shadow-sm"
                    >
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span>ฟิลเตอร์</span>
                      {(statusFilter.length > 0 || deptFilter.length > 0) && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                      )}
                    </button>
                    
                    {/* Filter Popup */}
                    {showFilterPopup && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-xl p-4 z-20">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-gray-800">ตั้งค่าฟิลเตอร์</h4>
                          <button onClick={() => setShowFilterPopup(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                          {/* Status Filter */}
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-2 block uppercase tracking-wider">สถานะ (Status)</label>
                            <div className="space-y-1">
                              {TASK_STATUSES.map(s => (
                                <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={statusFilter.includes(s)}
                                    onChange={(e) => {
                                      if (e.target.checked) setStatusFilter([...statusFilter, s]);
                                      else setStatusFilter(statusFilter.filter(item => item !== s));
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300 cursor-pointer"
                                  />
                                  {s}
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-px bg-gray-100 w-full"></div>
                          
                          {/* Department Filter */}
                          <div>
                            <label className="text-[11px] font-bold text-gray-500 mb-2 block uppercase tracking-wider">ฝ่าย (Department)</label>
                            <div className="space-y-1">
                              {DEPARTMENTS.map(d => (
                                <label key={d} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={deptFilter.includes(d)}
                                    onChange={(e) => {
                                      if (e.target.checked) setDeptFilter([...deptFilter, d]);
                                      else setDeptFilter(deptFilter.filter(item => item !== d));
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300 cursor-pointer"
                                  />
                                  {d}
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <div className="pt-3 border-t border-gray-100 flex justify-end">
                            <button 
                              onClick={() => { setStatusFilter([]); setDeptFilter([]); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={statusFilter.length === 0 && deptFilter.length === 0}
                            >
                              ล้างฟิลเตอร์ทั้งหมด
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm shrink-0">
                      <button 
                        onClick={() => setTaskView('table')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${taskView === 'table' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <AlignLeft className="w-4 h-4" /> Table
                      </button>
                      <button 
                        onClick={() => setTaskView('gallery')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${taskView === 'gallery' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                      >
                        <LayoutGrid className="w-4 h-4" /> Gallery
                      </button>
                    </div>
                    
                    {/* Production Ready "Add Task" Button */}
                    <button 
                      onClick={openAddTask}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> <span className="hidden sm:inline">เพิ่ม Task</span>
                    </button>
                  </div>
                </div>

                {/* View Content */}
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-lg">ไม่มีงานที่ตรงกับฟิลเตอร์ที่เลือก</p>
                    <p className="text-sm mt-1">ลองเปลี่ยนการตั้งค่าฟิลเตอร์หรือเพิ่มงานใหม่บนปฏิทิน</p>
                  </div>
                ) : (
                  <>
                    {/* --- Table View --- */}
                    {taskView === 'table' && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                              <tr>
                                <th className="px-5 py-4 font-medium">ชื่องาน (Task)</th>
                                <th className="px-5 py-4 font-medium">ผู้รับผิดชอบ (Assignee)</th>
                                <th className="px-5 py-4 font-medium">ฝ่าย (Department)</th>
                                <th className="px-5 py-4 font-medium">กำหนดส่ง (Due Date)</th>
                                <th className="px-5 py-4 font-medium w-40">สถานะ (Status)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredTasks.map(task => {
                                const assignee = getAssignee(task.assigneeId);
                                return (
                                  <tr key={task.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTaskDetail(task)}>
                                    <td className="px-5 py-4 font-medium text-gray-800">{task.title}</td>
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-full ${assignee.color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>{assignee.initials}</div>
                                        <span className="text-gray-700 font-medium">{assignee.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{task.department || 'Unassigned'}</span>
                                    </td>
                                    <td className="px-5 py-4 text-gray-600">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{task.endDate}</span>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{task.endTime}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="relative inline-block">
                                        <select
                                          value={task.status || 'To Do'}
                                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                          className={`text-xs font-bold rounded-full pl-3 pr-8 py-1.5 outline-none cursor-pointer appearance-none border transition-colors
                                            ${task.status === 'Done' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                                              task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 
                                              task.status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' : 
                                              'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}
                                          `}
                                        >
                                          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* --- Gallery View --- */}
                    {taskView === 'gallery' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filteredTasks.map(task => {
                          const assignee = getAssignee(task.assigneeId);
                          return (
                            <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col group cursor-pointer" onClick={() => openTaskDetail(task)}>
                              <div className="flex justify-between items-start mb-4">
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[11px] font-medium border border-gray-200 truncate max-w-[100px]">{task.department || 'Unassigned'}</span>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={task.status || 'To Do'}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                    className={`text-[10px] font-bold rounded-full pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none border transition-colors
                                      ${task.status === 'Done' ? 'bg-green-50 text-green-700 border-green-200' : 
                                        task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                        task.status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                        'bg-gray-50 text-gray-700 border-gray-200'}
                                    `}
                                  >
                                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                </div>
                              </div>
                              <h4 className="font-semibold text-gray-800 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{task.title}</h4>
                              <p className="text-xs text-gray-500 mb-5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {task.endDate} <span className="bg-gray-100 px-1.5 rounded">{task.endTime}</span>
                              </p>
                              <div className="flex items-center gap-2.5 mt-auto pt-4 border-t border-gray-100">
                                <div className={`w-7 h-7 rounded-full ${assignee.color} text-white flex items-center justify-center text-[10px] font-bold shadow-sm`}>{assignee.initials}</div>
                                <div className="flex-1 overflow-hidden">
                                  <span className="text-sm text-gray-700 font-medium block truncate">{assignee.name}</span>
                                  <span className="text-[10px] text-gray-400 block truncate">{assignee.role || 'Team Member'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-8">
                
                {/* Section: Member List */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">รายชื่อสมาชิกโปรเจกต์</h3>
                      <p className="text-sm text-gray-500 mt-1">จัดการรายชื่อผู้ที่สามารถเข้าถึงและทำงานในโปรเจกต์นี้</p>
                    </div>
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                      <Plus className="w-4 h-4" /> เพิ่มสมาชิก
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-6 py-4 font-medium w-1/2">ชื่อสมาชิก</th>
                          <th className="px-6 py-4 font-medium">บทบาท (Role)</th>
                          <th className="px-6 py-4 font-medium text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {teamMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4 flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full ${member.color} text-white flex items-center justify-center font-bold shadow-sm`}>
                                {member.initials}
                              </div>
                              <span className="font-medium text-gray-800">{member.name}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium 
                                ${member.role === 'Project Owner' ? 'bg-blue-100 text-blue-700' : 
                                  member.role === 'Approver' ? 'bg-purple-100 text-purple-700' : 
                                  member.role === 'Manager' ? 'bg-orange-100 text-orange-700' : 
                                  'bg-gray-100 text-gray-700'}`}
                              >
                                {member.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => removeMember(member.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="ลบสมาชิก"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section: Organizational Chart */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-8 overflow-hidden relative">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-semibold text-gray-800">ผังองค์กร (Organizational Chart)</h3>
                    <button className="text-sm font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 bg-white border px-3 py-1.5 rounded-lg shadow-sm">
                      <Edit2 className="w-4 h-4" /> แก้ไขโครงสร้าง
                    </button>
                  </div>

                  {/* Visual Org Chart Structure using Flexbox */}
                  <div className="flex flex-col items-center">
                    
                    {/* Level 1: Owner */}
                    {teamMembers.filter(m => m.level === 1).map(owner => (
                      <div key={owner.id} className="flex flex-col items-center">
                        <OrgNode member={owner} />
                        <div className="w-px h-8 bg-gray-300"></div> {/* Vertical line down */}
                      </div>
                    ))}

                    {/* Level 2: Managers/Approvers */}
                    <div className="relative flex justify-center w-full">
                      {/* Horizontal connecting line */}
                      <div className="absolute top-0 w-1/2 h-px bg-gray-300"></div>
                      
                      <div className="flex justify-center gap-16 md:gap-32 w-full pt-8 relative">
                        {teamMembers.filter(m => m.level === 2).map((manager, idx, arr) => (
                          <div key={manager.id} className="flex flex-col items-center relative">
                            {/* Vertical line up to horizontal line */}
                            <div className="absolute -top-8 w-px h-8 bg-gray-300"></div>
                            
                            <OrgNode member={manager} />
                            
                            {/* If this manager has level 3 staff under them, draw line down. 
                                For this mockup, we put all level 3s under the Tech Lead (u3) */}
                            {manager.id === 'u3' && (
                               <div className="w-px h-8 bg-gray-300"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Level 3: Contributors (Mockup placed under Tech Lead) */}
                    <div className="relative flex justify-center w-full mt-0">
                      <div className="flex justify-center gap-8 w-full pt-8 relative">
                         {/* Horizontal line for level 3 */}
                         <div className="absolute top-0 w-1/4 h-px bg-gray-300"></div>
                         
                         {teamMembers.filter(m => m.level === 3).map(staff => (
                            <div key={staff.id} className="flex flex-col items-center relative">
                               <div className="absolute -top-8 w-px h-8 bg-gray-300"></div>
                               <OrgNode member={staff} />
                            </div>
                         ))}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {activeTab === 'notes' && (
              <div className="flex flex-col h-[calc(100vh-180px)]">
                 {/* Top Toggle */}
                 <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 shrink-0">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-blue-600" /> Team Notes
                    </h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                      <button 
                        onClick={() => { setNoteSection('department'); setActiveNoteId(DEPARTMENTS[0]); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${noteSection === 'department' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        แยกตามฝ่าย
                      </button>
                      <button 
                        onClick={() => { setNoteSection('member'); setActiveNoteId(teamMembers.length > 0 ? teamMembers[0].id : ''); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${noteSection === 'member' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        แยกตามแต่ละคน
                      </button>
                    </div>
                 </div>

                 {/* Content Area */}
                 <div className="flex gap-6 flex-1 min-h-0">
                    {/* Sidebar List */}
                    <div className="w-64 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col shrink-0">
                      <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                         <h4 className="font-semibold text-gray-700 text-sm">
                           {noteSection === 'department' ? 'เลือกฝ่าย (Departments)' : 'เลือกสมาชิก (Members)'}
                         </h4>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                         {noteSection === 'department' ? (
                           DEPARTMENTS.map(dept => (
                             <button
                               key={dept}
                               onClick={() => setActiveNoteId(dept)}
                               className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNoteId === dept ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                             >
                               {dept}
                             </button>
                           ))
                         ) : (
                           teamMembers.map(member => (
                             <button
                               key={member.id}
                               onClick={() => setActiveNoteId(member.id)}
                               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNoteId === member.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                             >
                               <div className={`w-7 h-7 rounded-full ${member.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                                 {member.initials}
                               </div>
                               <div className="flex-1 overflow-hidden text-left">
                                 <span className="truncate block leading-tight">{member.name}</span>
                                 <span className="text-[10px] opacity-70 truncate block">{member.role}</span>
                               </div>
                             </button>
                           ))
                         )}
                      </div>
                    </div>

                    {/* Note Editor Area */}
                    <div className="flex-1 h-full">
                      {activeNoteId ? (
                        <NoteEditor 
                          noteId={activeNoteId} 
                          noteTitle={noteSection === 'department' ? `บันทึกของฝ่าย: ${activeNoteId}` : `บันทึกของ: ${teamMembers.find(m => m.id === activeNoteId)?.name || 'Unknown'}`}
                          initialContent={notesContent[activeNoteId] || ''}
                          onSave={(id, content) => setNotesContent(prev => ({ ...prev, [id]: content }))}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 bg-gray-50/50">
                           <FileText className="w-12 h-12 mb-3 text-gray-300" />
                           <p className="font-medium text-lg text-gray-500">กรุณาเลือกรายการทางซ้ายมือ</p>
                           <p className="text-sm mt-1">เพื่อเปิดดูหรือแก้ไขบันทึก (Notes)</p>
                        </div>
                      )}
                    </div>
                 </div>
                 
                 <style>{`
                    .rich-editor:empty:before {
                      content: attr(data-placeholder);
                      color: #9ca3af;
                      pointer-events: none;
                      display: block;
                    }
                 `}</style>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Slide-over Task Detail/Edit Pane */}
      <TaskDetailPane 
        isOpen={isPaneOpen} 
        onClose={() => setIsPaneOpen(false)} 
        task={paneTask} 
        onSave={(data) => { onSaveTask(data); setIsPaneOpen(false); }}
        onDelete={(id) => { onDeleteTask(id); setIsPaneOpen(false); }}
        teamMembers={teamMembers}
        TASK_STATUSES={TASK_STATUSES}
        DEPARTMENTS={DEPARTMENTS}
      />
    </div>
  );
}

// --- Task Detail & Edit Slide-over Pane ---
function TaskDetailPane({ isOpen, onClose, task, onSave, onDelete, teamMembers, TASK_STATUSES, DEPARTMENTS }) {
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('To Do');
  const [department, setDepartment] = useState('Unassigned');
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [description, setDescription] = useState('');

  // Update form when task changes or panel opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setIsEditing(false); // Default to view mode if opening existing task
        setTitle(task.title || '');
        setStatus(task.status || 'To Do');
        setDepartment(task.department || 'Unassigned');
        setAssigneeId(task.assigneeId || '');
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
        setStartTime(task.startTime || '09:00');
        setEndTime(task.endTime || '18:00');
        setDescription(task.description || '');
      } else {
        setIsEditing(true); // Force edit mode for new task
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setTitle('');
        setStatus('To Do');
        setDepartment('Unassigned');
        setAssigneeId(teamMembers.length > 0 ? teamMembers[0].id : '');
        setStartDate(todayStr);
        setEndDate(todayStr);
        setStartTime('09:00');
        setEndTime('18:00');
        setDescription('');
      }
    }
  }, [task, isOpen, teamMembers]);

  // Handle Save
  const handleSave = (e) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    
    onSave({
      id: task?.id,
      title, status, department, assigneeId, startDate, endDate, startTime, endTime, description
    });
  };

  if (!isOpen) return null;

  const currentAssignee = teamMembers.find(m => m.id === assigneeId) || { name: 'Unassigned', initials: '?', color: 'bg-gray-400' };

  return (
    <>
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-gray-900/40 z-40 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-l">
        
        {/* Header Options */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
          <div className="flex items-center gap-2">
            {!isEditing && task && (
              <button 
                onClick={() => onSave({ ...task, status: 'Done' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${task.status === 'Done' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                <CheckCircle className="w-4 h-4" /> {task.status === 'Done' ? 'Completed' : 'Mark Complete'}
              </button>
            )}
            {isEditing && <span className="font-bold text-gray-700">{task ? 'แก้ไข Task' : 'สร้าง Task ใหม่'}</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { if(window.confirm('คุณแน่ใจหรือไม่ที่จะลบ Task นี้?')) onDelete(task.id); }} 
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            // --- Edit / Create Form ---
            <form id="task-form" onSubmit={handleSave} className="p-6 flex flex-col gap-6">
              <div>
                <input 
                  type="text" 
                  placeholder="Task Name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-2xl font-bold border-none focus:ring-0 placeholder-gray-300 w-full p-0 text-gray-800 outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-y-5 gap-x-2 text-sm">
                <div className="text-gray-500 flex items-center gap-2"><Users className="w-4 h-4" /> ผู้รับผิดชอบ</div>
                <div>
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    <option value="" disabled>เลือกผู้รับผิดชอบ...</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> วันที่เริ่มต้น</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1" required />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> วันที่สิ้นสุด</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 flex-1" required />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border-gray-300 rounded-lg p-2 bg-gray-50 border outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Activity className="w-4 h-4" /> สถานะ</div>
                <div>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="text-gray-500 flex items-center gap-2"><Layers className="w-4 h-4" /> ฝ่าย</div>
                <div>
                  <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full border-gray-300 rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 border">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-2 border-t pt-5 border-gray-100">
                <div className="text-gray-500 flex items-center gap-2 mb-3 text-sm"><AlignLeft className="w-4 h-4" /> คำอธิบาย (Description)</div>
                <textarea 
                  placeholder="เพิ่มคำอธิบายรายละเอียดงาน..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border-gray-300 border rounded-lg p-3 bg-gray-50 min-h-[150px] outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                ></textarea>
              </div>
            </form>
          ) : (
            // --- View Mode ---
            <div className="p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-y-6 text-sm">
                <div className="text-gray-500">ผู้รับผิดชอบ</div>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${currentAssignee.color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>{currentAssignee.initials}</div>
                  <span className="font-medium text-gray-800">{currentAssignee.name}</span>
                </div>

                <div className="text-gray-500">วันที่เริ่มต้น</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {startDate} <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{startTime}</span>
                </div>

                <div className="text-gray-500">กำหนดส่ง</div>
                <div className="text-gray-800 font-medium flex items-center gap-2">
                  {endDate} <span className="text-gray-500 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{endTime}</span>
                </div>

                <div className="text-gray-500">สถานะ</div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border 
                    ${status === 'Done' ? 'bg-green-50 text-green-700 border-green-200' : 
                      status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                      'bg-gray-50 text-gray-700 border-gray-200'}
                  `}>
                    {status}
                  </span>
                </div>

                <div className="text-gray-500">ฝ่าย (Department)</div>
                <div>
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{department}</span>
                </div>
              </div>

              <div className="mt-4 border-t pt-6 border-gray-100">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">คำอธิบาย</h4>
                {description ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">ไม่มีคำอธิบายเพิ่มเติม</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Only show when editing) */}
        {isEditing && (
          <div className="p-4 border-t bg-white flex justify-end gap-3 shrink-0">
            {task && (
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ยกเลิก
              </button>
            )}
            {!task && (
              <button 
                type="button" 
                onClick={onClose}
                className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ปิด
              </button>
            )}
            <button 
              type="submit" 
              form="task-form"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              บันทึก
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Helper component for Org Chart Nodes
function OrgNode({ member }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-48 flex flex-col items-center text-center z-10 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
      <div className={`w-12 h-12 rounded-full ${member.color} text-white flex items-center justify-center font-bold text-lg shadow-inner mb-2`}>
        {member.initials}
      </div>
      <p className="font-bold text-gray-800 text-sm truncate w-full">{member.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate w-full">{member.role}</p>
    </div>
  );
}

// --- Note Editor Component for Team Notes ---
function NoteEditor({ noteId, noteTitle, initialContent, onSave }) {
  const editorRef = React.useRef(null);
  
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || '';
    }
  }, [noteId]);

  const handleInput = () => {
     if (editorRef.current) {
       onSave(noteId, editorRef.current.innerHTML);
     }
  };

  const insertImage = () => {
     const url = prompt('ใส่ URL รูปภาพ (หรือคุณสามารถกด Ctrl+V เพื่อวางรูปภาพในพื้นที่พิมพ์ได้เลย):', 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80');
     if (url) {
        document.execCommand('insertImage', false, url);
        handleInput();
     }
  };

  const execCmd = (cmd) => {
     document.execCommand(cmd, false, null);
     handleInput();
  };

  return (
     <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Editor Toolbar */}
        <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center gap-2">
           <h3 className="font-semibold text-gray-700 mr-auto flex items-center gap-2">
             <FileText className="w-4 h-4 text-blue-500" /> {noteTitle}
           </h3>
           
           <div className="flex items-center bg-white border border-gray-200 rounded-md p-1 shadow-sm">
             <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ตัวหนา (Ctrl+B)"><Bold size={16}/></button>
             <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ตัวเอียง (Ctrl+I)"><Italic size={16}/></button>
             <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ขีดเส้นใต้ (Ctrl+U)"><Underline size={16}/></button>
           </div>
           
           <div className="w-px h-6 bg-gray-300 mx-1"></div>
           
           <button 
             onClick={insertImage} 
             className="p-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-md text-gray-700 flex items-center gap-1.5 text-sm font-medium transition-colors shadow-sm"
           >
             <ImageIcon size={16} className="text-blue-500"/> แทรกรูป
           </button>
        </div>

        {/* Editable Content Area */}
        <div 
           ref={editorRef}
           contentEditable
           onInput={handleInput}
           data-placeholder="พิมพ์ข้อความ... หรือกด Ctrl+V เพื่อแปะรูปภาพได้ทันที"
           className="rich-editor flex-1 p-6 outline-none overflow-y-auto text-gray-800 text-sm md:text-base leading-relaxed bg-white prose max-w-none"
           style={{ minHeight: '300px' }}
        ></div>
        
        <div className="p-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 text-right">
          ข้อมูลจะถูกบันทึกอัตโนมัติ (Auto-saved)
        </div>
     </div>
  )
}

function MonthGrid({ year, month, projects, events, onDayClick, onEventClick, hidePastWeeks, currentWeekStart }) {
  // Date calculations
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const weekRows = [];
  let currentWeek = [];
  
  // Empty cells before the 1st day
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push({ empty: true, key: `empty-start-${i}`, date: new Date(year, month, i - firstDay + 1) });
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    currentWeek.push({ empty: false, key: dateStr, dateStr, day, dateObj: d });

    if (currentWeek.length === 7) {
      weekRows.push(currentWeek);
      currentWeek = [];
    }
  }

  // Add suffix empty cells to complete the last week
  if (currentWeek.length > 0) {
    let i = 0;
    while (currentWeek.length < 7) {
      currentWeek.push({ empty: true, key: `empty-end-${i}`, date: new Date(year, month + 1, i + 1) });
      i++;
    }
    weekRows.push(currentWeek);
  }

  // Filter out past weeks
  const visibleWeeks = weekRows.filter(week => {
    if (!hidePastWeeks) return true;
    // The last day of the week is Saturday
    const weekEndDate = week[6].empty ? week[6].date : week[6].dateObj;
    return weekEndDate >= currentWeekStart;
  });

  if (visibleWeeks.length === 0) return null;

  const cells = [];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  visibleWeeks.forEach(week => {
    week.forEach(dayData => {
      if (dayData.empty) {
        cells.push(<div key={dayData.key} className="min-h-[100px] border border-gray-100 bg-gray-50/50"></div>);
      } else {
        // Find events for this day
        const dayEvents = events.filter(e => {
          return dayData.dateStr >= e.startDate && dayData.dateStr <= e.endDate;
        });

        const isToday = todayStr === dayData.dateStr;

        cells.push(
          <div 
            key={dayData.key} 
            className={`min-h-[100px] border border-gray-100 p-1 cursor-pointer transition-colors hover:bg-blue-50 group flex flex-col`}
            onClick={() => onDayClick(dayData.dateStr)}
          >
            <div className={`text-right text-xs mb-1 font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
              <span className={isToday ? 'bg-blue-100 px-1.5 py-0.5 rounded-full' : ''}>{dayData.day}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
              {dayEvents.map(event => {
                const project = projects.find(p => p.id === event.projectId) || projects[0];
                const color = PROJECT_COLORS[project.colorIndex] || PROJECT_COLORS[0];
                
                return (
                  <div 
                    key={event.id}
                    onClick={(e) => onEventClick(event, e)}
                    className={`text-[10px] md:text-xs truncate px-1.5 py-0.5 rounded border ${color.lightBg} ${color.text} ${color.border} hover:opacity-80 transition-opacity`}
                    title={`${event.title} (${event.startTime} - ${event.endTime})`}
                  >
                    {event.startDate === dayData.dateStr && <span className="font-semibold mr-1">{event.startTime}</span>}
                    {event.title}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    });
  });

  return (
    <div className="flex flex-col h-full">
      {/* Days Header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 content-start">
        {cells}
      </div>
    </div>
  );
}

// --- Project Manager Modal ---
function ProjectManagerModal({ projects, onClose, onToggleVisibility, onSaveProject, onDeleteProject, displayRange, setDisplayRange, hidePastWeeks, setHidePastWeeks }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColorIndex, setEditColorIndex] = useState(0);

  const startEdit = (project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditColorIndex(project.colorIndex);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    onSaveProject({
      id: editingId,
      name: editName,
      colorIndex: editColorIndex
    });
    setEditingId(null);
    setEditName('');
  };

  const visibleCount = projects.filter(p => p.isVisible).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" /> จัดการ Project
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 mb-4">
            เลือกโปรเจกต์ที่จะแสดงบนหน้าจอหลัก (เลือกได้สูงสุด 4 โปรเจกต์) <br/>
            ปัจจุบันเลือกแล้ว: <span className={`font-bold ${visibleCount === 4 ? 'text-orange-500' : 'text-blue-600'}`}>{visibleCount}/4</span>
          </p>

          <div className="space-y-3">
            {projects.map(project => (
              <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 transition-colors">
                
                {editingId === project.id ? (
                  // Edit Mode
                  <div className="flex-1 flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="border rounded px-2 py-1 w-full text-sm focus:outline-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {PROJECT_COLORS.map((c, i) => (
                        <button 
                          key={i} 
                          onClick={() => setEditColorIndex(i)}
                          className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center ${editColorIndex === i ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                        >
                          {editColorIndex === i && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">บันทึก</button>
                      <button onClick={() => setEditingId(null)} className="text-xs bg-gray-200 px-3 py-1 rounded">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-center gap-3 flex-1">
                      <button 
                        onClick={() => onToggleVisibility(project.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${project.isVisible ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}
                      >
                        {project.isVisible && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <div className={`w-3 h-3 rounded-full ${PROJECT_COLORS[project.colorIndex].bg}`}></div>
                      <span className="font-medium truncate max-w-[150px]">{project.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(project)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm(`ต้องการลบโปรเจกต์ "${project.name}" และ Event ทั้งหมดในโปรเจกต์นี้ใช่หรือไม่?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add New Button */}
          {editingId !== 'new' && (
            <button 
              onClick={() => {
                setEditingId('new');
                setEditName('');
                setEditColorIndex(Math.floor(Math.random() * PROJECT_COLORS.length));
              }}
              className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> เพิ่ม Project ใหม่
            </button>
          )}

          {/* New Project Form */}
          {editingId === 'new' && (
             <div className="mt-4 p-3 border rounded-lg bg-blue-50/50 flex flex-col gap-3">
               <h3 className="font-semibold text-sm">สร้าง Project ใหม่</h3>
               <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="ชื่อโปรเจกต์..."
                  className="border rounded px-3 py-2 w-full text-sm focus:outline-blue-500"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  {PROJECT_COLORS.map((c, i) => (
                    <button 
                      key={i} 
                      onClick={() => setEditColorIndex(i)}
                      className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center ${editColorIndex === i ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                    >
                      {editColorIndex === i && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">เพิ่มโปรเจกต์</button>
                  <button onClick={() => setEditingId(null)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded font-medium">ยกเลิก</button>
                </div>
             </div>
          )}

          {/* --- Display Settings --- */}
          <div className="mt-6 pt-5 border-t border-gray-200 flex flex-col gap-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-500" /> ตั้งค่าการแสดงผล
            </h3>
            <div className="flex items-center gap-2 text-sm">
               <input
                 type="month"
                 value={displayRange.start}
                 onChange={(e) => setDisplayRange(prev => ({ ...prev, start: e.target.value }))}
                 className="border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1 bg-gray-50"
               />
               <span className="text-gray-500 font-medium">ถึง</span>
               <input
                 type="month"
                 value={displayRange.end}
                 onChange={(e) => setDisplayRange(prev => ({ ...prev, end: e.target.value }))}
                 className="border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1 bg-gray-50"
               />
            </div>
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer mt-2 p-2 rounded-md hover:bg-gray-50 transition-colors">
               <input
                 type="checkbox"
                 checked={hidePastWeeks}
                 onChange={(e) => setHidePastWeeks(e.target.checked)}
                 className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
               />
               <span>
                 <span className="font-medium text-gray-800">ซ่อนสัปดาห์และเดือนที่ผ่านมาแล้ว</span><br/>
                 <span className="text-xs text-gray-500">แสดงเฉพาะสัปดาห์ปัจจุบันถึงอนาคตเท่านั้น</span>
               </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Event Form Modal ---
function EventModal({ event, projects, defaultDate, defaultProjectId, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(event?.title || '');
  const [projectId, setProjectId] = useState(event?.projectId || defaultProjectId || (projects[0]?.id || ''));
  const [startDate, setStartDate] = useState(event?.startDate || defaultDate || '');
  const [endDate, setEndDate] = useState(event?.endDate || defaultDate || '');
  const [startTime, setStartTime] = useState(event?.startTime || '09:00');
  const [endTime, setEndTime] = useState(event?.endTime || '10:00');
  const [description, setDescription] = useState(event?.description || '');

  // Keep End Date >= Start Date
  useEffect(() => {
    if (startDate && (!endDate || startDate > endDate)) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    
    onSave({
      title, projectId, startDate, endDate, startTime, endTime, description
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {event ? 'แก้ไข Event' : 'เพิ่ม Event ใหม่'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Title Input */}
          <input 
            type="text" 
            placeholder="เพิ่มชื่อ Event"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-medium border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none w-full pb-1 transition-colors"
            autoFocus
            required
          />

          {/* Project Selector */}
          <div className="flex items-center gap-3 text-gray-600">
            <Layers className="w-5 h-5" />
            <select 
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex-1 border-gray-300 rounded-md p-2 bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="" disabled>เลือก Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <Clock className="w-5 h-5 mt-2" />
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1"
                  required
                />
                <input 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm w-28"
                  required
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm w-28"
                  required
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16">ถึงวันที่:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border-gray-300 rounded-md p-1.5 bg-gray-50 text-sm flex-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-3 text-gray-600 mt-2">
            <AlignLeft className="w-5 h-5 mt-2" />
            <textarea 
              placeholder="เพิ่มคำอธิบาย..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 border-gray-300 rounded-md p-2 bg-gray-50 min-h-[100px] resize-y focus:ring-blue-500 focus:border-blue-500 text-sm"
            ></textarea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            {event && (
              <button 
                type="button" 
                onClick={() => {
                  if(window.confirm('คุณแน่ใจหรือไม่ที่จะลบ Event นี้?')) onDelete(event.id);
                }}
                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors mr-auto"
              >
                ลบ Event
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
#nullable disable

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Dev.Service.Supervisor
{
    static class ProcessJob
    {
        const int JobObjectExtendedLimitInformation = 9;
        const uint KillOnJobClose = 0x2000;

        static readonly IntPtr handle = Create();

        public static void Add(Process process)
        {
            if (handle != IntPtr.Zero)
                AssignProcessToJobObject(handle, process.Handle);
        }

        static IntPtr Create()
        {
            if (!OperatingSystem.IsWindows())
                return IntPtr.Zero;

            var job = CreateJobObject(IntPtr.Zero, null);
            var info = new ExtendedLimitInformation { BasicLimitInformation = new BasicLimitInformation { LimitFlags = KillOnJobClose } };
            var length = Marshal.SizeOf<ExtendedLimitInformation>();
            var pointer = Marshal.AllocHGlobal(length);
            try
            {
                Marshal.StructureToPtr(info, pointer, false);
                return SetInformationJobObject(job, JobObjectExtendedLimitInformation, pointer, (uint)length) ? job : IntPtr.Zero;
            }
            finally
            {
                Marshal.FreeHGlobal(pointer);
            }
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr attributes, string name);

        [DllImport("kernel32.dll")]
        static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

        [DllImport("kernel32.dll")]
        static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [StructLayout(LayoutKind.Sequential)]
        struct BasicLimitInformation
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IoCounters
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct ExtendedLimitInformation
        {
            public BasicLimitInformation BasicLimitInformation;
            public IoCounters IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }
    }
}

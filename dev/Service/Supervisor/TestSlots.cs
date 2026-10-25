#nullable disable

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace Dev.Service.Supervisor
{
    /// <summary>
    /// The test slots that the runs of all checkouts share: a Playwright worker runs a test only while it holds one (see
    /// tools/dev/slots.cjs), so at most TestRunner.MaxWorkers tests run at once, whatever workers the runs started with.
    /// A run speeds up as soon as another one's tests end, and a lower budget applies from the next test on.
    /// </summary>
    public static class TestSlots
    {
        sealed record Holder(string Run, int Pid);

        sealed class Waiter
        {
            public Holder Holder;
            public readonly TaskCompletionSource Granted = new(TaskCreationOptions.RunContinuationsAsynchronously);
        }

        static readonly object gate = new();
        static readonly List<Holder> held = new();
        // First come, first served; a worker keeps its place while it asks again after a timeout
        static readonly List<Waiter> waiting = new();

        public static int InUse
        {
            get
            {
                lock (gate)
                    return held.Count;
            }
        }

        /// <summary>
        /// Whether the worker got a slot within the wait; it asks again when not. A worker holds one slot at most, so one it
        /// already holds (granted while it was not asking, or kept by a test that ended without letting go) is its own.
        /// </summary>
        public static async Task<bool> Acquire(string run, int pid, TimeSpan wait)
        {
            var holder = new Holder(run, pid);
            Task granted;
            lock (gate)
            {
                if (held.Contains(holder))
                    return true;

                var waiter = waiting.FirstOrDefault(w => w.Holder == holder);
                if (waiter == null)
                {
                    waiter = new Waiter { Holder = holder };
                    waiting.Add(waiter);
                }

                // Also when it asks again: a holder that crashed since then frees its slot only here
                Grant();

                granted = waiter.Granted.Task;
            }

            await Task.WhenAny(granted, Task.Delay(wait));
            return granted.IsCompleted;
        }

        public static void Release(string run, int pid)
        {
            lock (gate)
            {
                held.Remove(new Holder(run, pid));
                Grant();
            }
        }

        /// <summary>
        /// Frees the slots of a run that ended, also those of workers it killed in a test.
        /// </summary>
        public static void ReleaseRun(string run)
        {
            lock (gate)
            {
                held.RemoveAll(h => h.Run == run);
                waiting.RemoveAll(w => w.Holder.Run == run);
                Grant();
            }
        }

        /// <summary>
        /// Hands out the free slots in order, after a release or a higher budget.
        /// </summary>
        public static void Rebalance()
        {
            lock (gate)
                Grant();
        }

        static void Grant()
        {
            // A worker that crashed in a test never lets go of its slot; when slots run short, its run may still go on
            if (waiting.Count > 0 && held.Count >= TestRunner.MaxWorkers)
            {
                held.RemoveAll(h => !Alive(h.Pid));
                waiting.RemoveAll(w => !Alive(w.Holder.Pid));
            }

            while (waiting.Count > 0 && held.Count < TestRunner.MaxWorkers)
            {
                var next = waiting[0];
                waiting.RemoveAt(0);
                held.Add(next.Holder);
                next.Granted.TrySetResult();
            }
        }

        static bool Alive(int pid)
        {
            try
            {
                using var process = Process.GetProcessById(pid);
                return !process.HasExited;
            }
            catch (Exception e) when (e is ArgumentException or InvalidOperationException)
            {
                return false;
            }
        }
    }
}

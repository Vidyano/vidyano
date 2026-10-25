#nullable disable

using System;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace Dev.Service.Supervisor
{
    public sealed class SupervisorLoggerProvider : ILoggerProvider
    {
        const int MaxPending = 500;
        static readonly List<(string Text, string Level)> pending = new();

        public ILogger CreateLogger(string categoryName)
        {
            return new SupervisorLogger(categoryName);
        }

        public void Dispose()
        {
        }

        static void Write(string text, string level)
        {
            var supervisor = DevSupervisor.Instance;
            if (supervisor != null)
            {
                supervisor.ServerLog(text, level);
                return;
            }

            lock (pending)
            {
                if (pending.Count < MaxPending)
                    pending.Add((text, level));
            }
        }

        public static void Flush(DevSupervisor supervisor)
        {
            lock (pending)
            {
                foreach (var (text, level) in pending)
                    supervisor.ServerLog(text, level);

                pending.Clear();
            }
        }

        sealed class SupervisorLogger : ILogger
        {
            readonly string category;

            public SupervisorLogger(string category)
            {
                var dot = category.LastIndexOf('.');
                this.category = dot >= 0 ? category[(dot + 1)..] : category;
            }

            public IDisposable BeginScope<TState>(TState state) => null;

            public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
            {
                var message = formatter(state, exception);
                if (exception != null)
                    message = $"{message}\n{exception}";

                if (string.IsNullOrWhiteSpace(message))
                    return;

                var level = logLevel >= LogLevel.Error ? "error" : logLevel == LogLevel.Warning ? "warn" : "info";
                Write($"{category}: {message}", level);
            }
        }
    }
}

using System;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.CustomActions;

public partial class PushData : AsyncStreamingAction<VidyanoWeb3Context>
{
    public PushData(VidyanoWeb3Context context, StreamingActionStream streamWriter, IServiceProvider serviceProvider)
        : base(context, streamWriter, serviceProvider)
    {
    }

    public override async Task ExecuteAsync(StreamingActionArgs args)
    {
        await args.ChangeTitle("Party Time!");

        var message = "We are starting a party. ";
        using var log = Manager.Current.UpdatableLog(message + "\n", LogType.Information);
        await args.SendMessage(message);

        for (int i = 0; i < 20; i++)
        {
            if (i % 10 == 0)
                await args.ChangeTitle($"Party Time! ({i})");

            message = $"{i}: Let's get this party started";
            await args.SendMessage(message);
            log.AppendLine(message + (!args.StillStreaming ? " (disconnected)" : ""));

            await Task.Delay(1000);
        }

        message = $"This party is over";
        await args.SendMessage(message);
        log.AppendLine(message);

        await args.ChangeTitle("Party Time! (done)");
    }
}
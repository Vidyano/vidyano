using System;
using System.Threading.Tasks;
using Vidyano.Service;
using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class PushData : AsyncStreamingAction<DevContext>
{
    public PushData(DevContext context, StreamingActionStream streamWriter, IServiceProvider serviceProvider, IAuthenticatedRequest authenticatedRequest)
        : base(context, streamWriter, serviceProvider, authenticatedRequest)
    {
    }

    public override async Task ExecuteAsync(StreamingActionArgs args)
    {
        await args.UpdateDialog(new StreamingDialogOptions
        {
            Title = "Party Time!"
        });

        var message = "We are starting a party. ";
        using var log = Manager.Current.UpdatableLog(message + "\n", LogType.Information);
        await args.SendMessage(message);

        for (int i = 0; i < 20; i++)
        {
            if (i % 10 == 0)
            {
                await args.UpdateDialog(new StreamingDialogOptions
                {
                    Title = $"Party Time! ({i})"
                });
            }

            message = $"{i}: Let's get this party started";
            await args.SendMessage(message);
            log.AppendLine(message + (!args.StillStreaming ? " (disconnected)" : ""));

            await Task.Delay(1000);
        }

        message = $"This party is over";
        await args.SendMessage(message);
        log.AppendLine(message);

        await args.UpdateDialog(new StreamingDialogOptions
        {
            Title = "Party Time! (done)"
        });
    }
}
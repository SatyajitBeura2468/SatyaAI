using System.IO.Pipes;
using System.Text;

namespace SatyaAI.Drishti.Companion;

internal static class Program
{
    private const string MutexName = @"Local\SatyaAI.Drishti.Companion";
    private const string PipeName = "SatyaAI.Drishti.Companion.Command";

    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        using var mutex = new Mutex(initiallyOwned: true, MutexName, out var isFirstInstance);
        if (!isFirstInstance)
        {
            SignalExistingInstance();
            return;
        }

        Application.Run(new CompanionForm(args));
    }

    private static void SignalExistingInstance()
    {
        for (var attempt = 0; attempt < 4; attempt++)
        {
            try
            {
                using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
                pipe.Connect(timeout: 700);
                using var writer = new StreamWriter(pipe, new UTF8Encoding(false), leaveOpen: true);
                writer.WriteLine("start");
                writer.Flush();
                return;
            }
            catch (TimeoutException)
            {
                Thread.Sleep(250);
            }
            catch (IOException)
            {
                Thread.Sleep(250);
            }
        }
    }
}
